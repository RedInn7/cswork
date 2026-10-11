import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
const directory = mkdtempSync(resolve(tmpdir(), 'cswork-commerce-'));
process.env.DATABASE_PATH = resolve(directory, 'commerce.sqlite');
process.env.APP_URL = 'http://localhost:4317';
process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_fixture';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_isolated_fixture';
const sessions = new Map<string, any>(),
  intents = new Map<string, any>(),
  refunds = new Map<string, any>(),
  idempotency = new Map<string, any>();
let creates = 0,
  refundCreates = 0;
let nextRefundStatus = 'succeeded';
let priceResponseHook: (() => void) | undefined;
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost'),
    parts = url.pathname.split('/');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const fields = new URLSearchParams(raw);
  let result: any;
  if (url.pathname.startsWith('/v1/prices/')) {
    priceResponseHook?.();
    priceResponseHook = undefined;
    result = {
      id: parts.at(-1),
      object: 'price',
      active: true,
      type: 'one_time',
      recurring: null,
      unit_amount: 100,
      currency: 'usd',
      product: { id: 'prod_fixture', object: 'product', active: true },
    };
  } else if (
    url.pathname === '/v1/checkout/sessions' &&
    req.method === 'POST'
  ) {
    const key = req.headers['idempotency-key'] as string;
    if (idempotency.has(key)) result = idempotency.get(key);
    else {
      creates++;
      const id = `cs_test_${randomUUID().replaceAll('-', '')}`;
      result = {
        id,
        object: 'checkout.session',
        status: 'open',
        mode: 'payment',
        payment_status: 'unpaid',
        amount_total: 100,
        currency: 'usd',
        url: `https://checkout.stripe.com/c/pay/${id}`,
        payment_intent: null,
        client_reference_id: fields.get('client_reference_id'),
        metadata: {
          orderId: fields.get('metadata[orderId]'),
          courseId: fields.get('metadata[courseId]'),
        },
        line_items: {
          data: [
            { quantity: 1, price: { id: fields.get('line_items[0][price]') } },
          ],
        },
      };
      sessions.set(id, result);
      idempotency.set(key, result);
    }
  } else if (url.pathname.startsWith('/v1/checkout/sessions/'))
    result = sessions.get(parts.at(-1)!);
  else if (url.pathname.startsWith('/v1/payment_intents/'))
    result = intents.get(parts.at(-1)!);
  else if (url.pathname === '/v1/refunds' && req.method === 'GET')
    result = {
      object: 'list',
      url: '/v1/refunds',
      has_more: false,
      data: [...refunds.values()].filter(
        (r) => r.payment_intent === url.searchParams.get('payment_intent'),
      ),
    };
  else if (url.pathname === '/v1/refunds' && req.method === 'POST') {
    const key = req.headers['idempotency-key'] as string;
    if (idempotency.has(key)) result = idempotency.get(key);
    else {
      refundCreates++;
      result = {
        id: `re_${randomUUID().replaceAll('-', '')}`,
        object: 'refund',
        payment_intent: fields.get('payment_intent'),
        amount: Number(fields.get('amount')),
        currency: 'usd',
        status: nextRefundStatus,
        created: Math.floor(Date.now() / 1000),
        metadata: {
          orderId: fields.get('metadata[orderId]'),
          csworkRefundId: fields.get('metadata[csworkRefundId]'),
        },
      };
      nextRefundStatus = 'succeeded';
      refunds.set(result.id, result);
      idempotency.set(key, result);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  if (!result) {
    res.statusCode = 404;
    result = {
      error: { type: 'invalid_request_error', message: 'fixture not found' },
    };
  }
  res.end(JSON.stringify(result));
});
const { sqlite } = await import('../db/sqlite');
const {
  checkout,
  reconcileSession,
  webhook,
  orderRow,
  refundOrder,
  orderDetail,
} = await import('../lib/server/payments');
const { handleCommerce } = await import('../lib/server/commerce');
const student: Person = {
  id: 'student',
  name: 'Student',
  email: 'student@example.test',
  verified: true,
  role: 'student',
};
const teacher: Person = {
  ...student,
  id: 'teacher',
  email: 'teacher@example.test',
  role: 'teacher',
};
const failure = (status: number) => (e: unknown) =>
  Boolean(e && typeof e === 'object' && 'status' in e && e.status === status);
function user(id: string): Person {
  return { ...student, id, email: `${id}@example.test` };
}
function complete(id: string, status = 'succeeded') {
  const s = sessions.get(id),
    pi = {
      id: `pi_${id}`,
      object: 'payment_intent',
      status,
      metadata: { orderId: s.metadata.orderId },
      latest_charge: {
        id: `ch_${id}`,
        object: 'charge',
        receipt_url: 'https://pay.stripe.com/receipts/fixture',
        refunded: false,
      },
    };
  intents.set(pi.id, pi);
  Object.assign(s, {
    status: 'complete',
    payment_status: status === 'succeeded' ? 'paid' : 'unpaid',
    payment_intent: pi,
  });
  return s;
}
async function deliver(type: string, value: any, id = `evt_${randomUUID()}`) {
  const raw = JSON.stringify({
    id,
    object: 'event',
    type,
    data: { object: value },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return webhook(
    new Request('http://localhost:4317/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: raw,
    }),
  );
}
before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  process.env.STRIPE_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published,price_id) VALUES('gomall','Test course','','1',1,'price_fixture')",
    )
    .run();
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published,price_id) VALUES('systems','Systems course','','1',1,'price_systems')",
    )
    .run();
});
after(async () => {
  sqlite().close();
  await new Promise<void>((r, e) =>
    server.close((error) => (error ? e(error) : r())),
  );
  rmSync(directory, { recursive: true, force: true });
});

test('unverified checkout and cross-user order reads are rejected', async () => {
  await assert.rejects(
    checkout({ ...student, verified: false }, 'gomall'),
    failure(403),
  );
  const order = await checkout(user('owner'), 'gomall');
  await assert.rejects(
    orderDetail(user('outsider'), order.orderId),
    failure(404),
  );
});
test('concurrent checkouts share one durable order and one Stripe session', async () => {
  const before = creates;
  const p = user('concurrent');
  const [a, b] = await Promise.all([
    checkout(p, 'gomall'),
    checkout(p, 'gomall'),
  ]);
  assert.equal(a.orderId, b.orderId);
  assert.equal(a.url, b.url);
  assert.equal(creates - before, 1);
});
test('second course uses its own configured price', async () => {
  const a = await checkout(user('multicourse'), 'systems');
  assert.equal(orderRow(a.orderId)?.price_id, 'price_systems');
});
test('expired and delayed-payment-failed checkouts can create a fresh purchase', async () => {
  const p = user('expired'),
    a = await checkout(p, 'gomall'),
    old = orderRow(a.orderId)!;
  sessions.get(old.checkout_id!).status = 'expired';
  await deliver('checkout.session.expired', sessions.get(old.checkout_id!));
  assert.equal(orderRow(a.orderId)?.status, 'expired');
  const b = await checkout(p, 'gomall');
  assert.notEqual(a.orderId, b.orderId);
  complete(orderRow(b.orderId)!.checkout_id!, 'requires_payment_method');
  await deliver(
    'checkout.session.async_payment_failed',
    sessions.get(orderRow(b.orderId)!.checkout_id!),
  );
  assert.equal(orderRow(b.orderId)?.status, 'failed');
  const c = await checkout(p, 'gomall');
  assert.notEqual(c.orderId, b.orderId);
});
test('payment reconciliation recovers a missing webhook and duplicate delivery is idempotent', async () => {
  const p = user('paid'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  await reconcileSession(session.id, p);
  assert.equal(orderRow(a.orderId)?.status, 'paid');
  assert.equal((await orderDetail(p, a.orderId)).has_access, true);
  await deliver('checkout.session.completed', session, 'evt_duplicate');
  await deliver('checkout.session.completed', session, 'evt_duplicate');
  assert.equal(
    (
      sqlite()
        .prepare('SELECT COUNT(*) n FROM grants WHERE id=?')
        .get(`order:${a.orderId}`) as { n: number }
    ).n,
    1,
  );
  await assert.rejects(
    reconcileSession(session.id, user('another')),
    failure(404),
  );
});
test('signature and mismatched Price cannot create course access', async () => {
  await assert.rejects(
    webhook(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'invalid' },
        body: '{}',
      }),
    ),
    failure(400),
  );
  const p = user('tampered'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  session.line_items.data[0].price.id = 'price_wrong';
  await assert.rejects(
    deliver('checkout.session.completed', session),
    failure(400),
  );
  assert.equal((await orderDetail(p, a.orderId)).has_access, false);
});
test('partial/full refunds are idempotent, late completion cannot restore refunded access, independent grants survive', async () => {
  const p = user('refund'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  await reconcileSession(session.id, p);
  const key = randomUUID(),
    before = refundCreates;
  await refundOrder(teacher, a.orderId, {
    amount: 40,
    reason: 'Partial test refund',
    idempotencyKey: key,
  });
  await refundOrder(teacher, a.orderId, {
    amount: 40,
    reason: 'Partial test refund',
    idempotencyKey: key,
  });
  assert.equal(refundCreates - before, 1);
  assert.equal(orderRow(a.orderId)?.status, 'partially_refunded');
  assert.equal((await orderDetail(p, a.orderId)).has_access, true);
  sqlite()
    .prepare(
      "INSERT INTO grants(id,email,course_id,source,created_at) VALUES('instructor-independent',?,'gomall','instructor',?)",
    )
    .run(p.email, Date.now());
  await refundOrder(teacher, a.orderId, {
    amount: 60,
    reason: 'Remaining test refund',
    idempotencyKey: randomUUID(),
  });
  await deliver('checkout.session.completed', session);
  assert.equal(orderRow(a.orderId)?.status, 'refunded');
  assert.ok(
    (
      sqlite()
        .prepare('SELECT revoked_at FROM grants WHERE id=?')
        .get(`order:${a.orderId}`) as { revoked_at: number }
    ).revoked_at,
  );
  assert.equal((await orderDetail(p, a.orderId)).has_access, true);
});
test('failed refund reconciliation restores only a grant revoked by that refund', async () => {
  const p = user('failed-refund'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  await reconcileSession(session.id, p);
  await refundOrder(teacher, a.orderId, {
    amount: 100,
    reason: 'Full test refund',
    idempotencyKey: randomUUID(),
  });
  assert.equal((await orderDetail(p, a.orderId)).has_access, false);
  const refund = [...refunds.values()].find(
    (r) => r.payment_intent === session.payment_intent.id,
  )!;
  refund.status = 'failed';
  refund.failure_reason = 'lost_or_stolen_card';
  await deliver('refund.failed', refund);
  assert.equal(orderRow(a.orderId)?.status, 'paid');
  assert.equal((await orderDetail(p, a.orderId)).has_access, true);
});
test('pending refund reserves its amount, keeps access until success and prevents double refund', async () => {
  const p = user('pending-refund'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  await reconcileSession(session.id, p);
  nextRefundStatus = 'pending';
  await refundOrder(teacher, a.orderId, {
    amount: 100,
    reason: 'Pending test refund',
    idempotencyKey: randomUUID(),
  });
  assert.equal(orderRow(a.orderId)?.status, 'paid');
  assert.equal((await orderDetail(p, a.orderId)).has_access, true);
  await assert.rejects(
    refundOrder({ ...teacher, id: 'teacher-second' }, a.orderId, {
      amount: 1,
      reason: 'Duplicate amount test',
      idempotencyKey: randomUUID(),
    }),
    failure(409),
  );
  const refund = [...refunds.values()].find(
    (r) => r.payment_intent === session.payment_intent.id,
  )!;
  refund.status = 'succeeded';
  await deliver('refund.updated', refund);
  assert.equal((await orderDetail(p, a.orderId)).has_access, false);
});
test('refund recovery never undoes a later teacher revocation', async () => {
  const p = user('manual-revoke'),
    a = await checkout(p, 'gomall'),
    session = complete(orderRow(a.orderId)!.checkout_id!);
  await reconcileSession(session.id, p);
  await refundOrder({ ...teacher, id: 'teacher-manual' }, a.orderId, {
    amount: 100,
    reason: 'Full test refund',
    idempotencyKey: randomUUID(),
  });
  sqlite()
    .prepare('UPDATE grants SET revoked_at=? WHERE id=?')
    .run(Date.now() + 1000, `order:${a.orderId}`);
  const refund = [...refunds.values()].find(
    (r) => r.payment_intent === session.payment_intent.id,
  )!;
  refund.status = 'failed';
  await deliver('refund.failed', refund);
  assert.equal(orderRow(a.orderId)?.status, 'paid');
  assert.equal((await orderDetail(p, a.orderId)).has_access, false);
});
test('commerce routes enforce teacher role, method and request origin', async () => {
  await assert.rejects(
    handleCommerce(
      new Request('http://localhost:4317/api/teacher/orders'),
      student,
      ['teacher', 'orders'],
    ),
    failure(403),
  );
  await assert.rejects(
    handleCommerce(
      new Request('http://localhost:4317/api/checkout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: '{}',
      }),
      student,
      ['checkout'],
    ),
    failure(403),
  );
  await assert.rejects(
    handleCommerce(new Request('http://localhost:4317/api/checkout'), student, [
      'checkout',
    ]),
    failure(405),
  );
  assert.equal(
    await handleCommerce(new Request('http://localhost/api/lessons'), student, [
      'lessons',
    ]),
    null,
  );
});

test('teacher can configure a hidden course without opening checkout', async () => {
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published) VALUES('hidden','Hidden course','','1',0)",
    )
    .run();
  const response = await handleCommerce(
    new Request('http://localhost:4317/api/teacher/courses/hidden/price', {
      method: 'POST',
      headers: { origin: 'http://localhost:4317' },
      body: JSON.stringify({ priceId: 'price_hidden' }),
    }),
    teacher,
    ['teacher', 'courses', 'hidden', 'price'],
  );
  assert.equal(response?.status, 200);
  assert.equal((await response!.json()).purchase_available, false);
  await assert.rejects(checkout(user('hidden'), 'hidden'), failure(404));
});

void test('existing course access is honored even when checkout is not configured', async () => {
  const p = user('already-enrolled-without-payments');
  sqlite()
    .prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    )
    .run(randomUUID(), p.email, 'gomall', 'instructor', Date.now());
  const key = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    await assert.rejects(checkout(p, 'gomall'), failure(409));
    await assert.rejects(
      checkout(user('not-enrolled-without-payments'), 'gomall'),
      failure(503),
    );
  } finally {
    process.env.STRIPE_SECRET_KEY = key;
  }
});

test('checkout admission is rechecked after Stripe latency when the course is hidden', async () => {
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published,price_id) VALUES('race-hidden','Race hidden','','1',1,'price_racehidden')",
    )
    .run();
  priceResponseHook = () => {
    sqlite()
      .prepare("UPDATE courses SET published=0 WHERE id='race-hidden'")
      .run();
  };
  const count = creates;
  await assert.rejects(
    checkout(user('race-hidden'), 'race-hidden'),
    failure(404),
  );
  assert.equal(creates, count);
});
test('checkout admission is rechecked after Stripe latency when access is already granted', async () => {
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published,price_id) VALUES('race-owned','Race owned','','1',1,'price_raceowned')",
    )
    .run();
  const p = user('race-owned');
  priceResponseHook = () => {
    sqlite()
      .prepare(
        "INSERT INTO grants(id,email,course_id,source,created_at) VALUES('race-owned-grant',?,'race-owned','instructor',?)",
      )
      .run(p.email, Date.now());
  };
  const count = creates;
  await assert.rejects(checkout(p, 'race-owned'), failure(409));
  assert.equal(creates, count);
});
test('money() keeps its Chinese format and formats English separately', async () => {
  const { money } = await import('../lib/commerce-types');
  assert.equal(money(9900, 'cny'), '¥99.00');
  assert.equal(money(9900, 'cny', 'en'), 'CN¥99.00');
  assert.equal(money(null, 'usd'), '待确认金额');
  assert.equal(money(null, 'usd', 'en'), 'Amount pending');
});
