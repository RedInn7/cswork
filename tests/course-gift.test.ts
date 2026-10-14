import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-gift-'));
process.env.DATABASE_PATH = resolve(dir, 'gift.sqlite');
process.env.APP_URL = 'http://localhost:4317';
process.env.STRIPE_SECRET_KEY = 'sk_test_gift_fixture';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_gift_fixture';

// A small Stripe: prices, checkout sessions (keeping their metadata), payment intents, refunds.
const sessions = new Map<string, any>(),
  intents = new Map<string, any>(),
  refunds: any[] = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  const last = url.pathname.split('/').at(-1)!;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const fields = new URLSearchParams(raw);
  let result: any;
  if (url.pathname.startsWith('/v1/prices/'))
    result = {
      id: last,
      object: 'price',
      active: true,
      type: 'one_time',
      recurring: null,
      unit_amount: 100,
      currency: 'usd',
      product: { id: 'prod_fixture', object: 'product', active: true },
    };
  else if (url.pathname === '/v1/checkout/sessions' && req.method === 'POST') {
    const id = `cs_test_${randomUUID().replaceAll('-', '')}`;
    const metadata: Record<string, string> = {};
    for (const [key, value] of fields) {
      const m = /^metadata\[(\w+)\]$/.exec(key);
      if (m) metadata[m[1]] = value;
    }
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
      success_url: fields.get('success_url'),
      metadata,
      line_items: { data: [{ quantity: 1, price: { id: fields.get('line_items[0][price]') } }] },
    };
    sessions.set(id, result);
  } else if (url.pathname.startsWith('/v1/checkout/sessions/')) result = sessions.get(last);
  else if (url.pathname.startsWith('/v1/payment_intents/')) result = intents.get(last);
  else if (url.pathname === '/v1/refunds')
    result = {
      object: 'list',
      url: '/v1/refunds',
      has_more: false,
      data: refunds.filter((r) => r.payment_intent === url.searchParams.get('payment_intent')),
    };
  res.setHeader('Content-Type', 'application/json');
  if (!result) {
    res.statusCode = 404;
    result = { error: { type: 'invalid_request_error', message: 'fixture not found' } };
  }
  res.end(JSON.stringify(result));
});
const { sqlite } = await import('../db/sqlite');
const { checkout, reconcileSession, orderRow, orderDetail } = await import('../lib/server/payments');
const { handleCommerce } = await import('../lib/server/commerce');
const { giftCode } = await import('../lib/server/course-gifts');

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
const failure = (status: number) => (e: unknown) =>
  Boolean(e && typeof e === 'object' && 'status' in e && e.status === status);
function pay(sessionId: string) {
  const s = sessions.get(sessionId);
  const pi = {
    id: `pi_${sessionId}`,
    object: 'payment_intent',
    status: 'succeeded',
    metadata: { orderId: s.metadata.orderId },
    latest_charge: { id: `ch_${sessionId}`, object: 'charge', receipt_url: null, refunded: false },
  };
  intents.set(pi.id, pi);
  Object.assign(s, { status: 'complete', payment_status: 'paid', payment_intent: pi });
  return s;
}
function refundAll(sessionId: string) {
  refunds.push({
    id: `re_${randomUUID().replaceAll('-', '')}`,
    object: 'refund',
    payment_intent: `pi_${sessionId}`,
    amount: 100,
    currency: 'usd',
    status: 'succeeded',
    created: Math.floor(Date.now() / 1000),
    metadata: {},
  });
}
async function api(p: Person, path: string, body: unknown) {
  const request = new Request(`http://localhost:4317/api/${path}`, {
    method: 'POST',
    headers: { origin: 'http://localhost:4317', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await handleCommerce(request, p, path.split('/'));
  return (await response!.json()) as any;
}
const access = (email: string) =>
  !!sqlite()
    .prepare("SELECT 1 FROM grants WHERE email=? AND course_id='gomall' AND revoked_at IS NULL")
    .get(email);
/** Buys the course as a gift and pays for it: the order id and the buyer's code. */
async function giftPaid(buyer: Person) {
  const started = await checkout(buyer, 'gomall', true);
  const order = orderRow(started.orderId)!;
  const session = sessions.get(order.checkout_id!);
  assert.equal(session.metadata.gift, '1');
  assert.ok(session.success_url.includes('view=account&payment=success'));
  await reconcileSession(pay(order.checkout_id!).id, buyer);
  const detail = await orderDetail(buyer, started.orderId);
  return { orderId: started.orderId, sessionId: order.checkout_id!, code: detail.gift!.code! };
}

before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.STRIPE_API_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare("INSERT INTO courses(id,title,summary,version,published,price_id) VALUES('gomall','Test course','','1',1,'price_fixture')")
    .run();
});
after(async () => {
  sqlite().close();
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

void test('codes: 16 unambiguous characters in groups of four, pasted any way', () => {
  assert.equal(giftCode('abcd efgh-jkmn pqrs'), 'ABCD-EFGH-JKMN-PQRS');
  assert.equal(giftCode('ABCD-EFGH-JKMN-PQR'), null);
  assert.equal(giftCode('ABCD-EFGH-JKMN-PQR0'), null); // 0 is not in the alphabet
});

void test('a paid gift gives the buyer a code, not access; someone else redeems it once', async () => {
  const buyer = person('g-buyer');
  // Owning the course does not stop buying it for someone else.
  sqlite()
    .prepare("INSERT INTO grants(id,email,course_id,source,created_at) VALUES('own-g-buyer',?,'gomall','instructor',?)")
    .run(buyer.email, Date.now());
  const { orderId, code } = await giftPaid(buyer);
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  assert.equal(orderRow(orderId)!.status, 'paid');
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM grants WHERE id=?').pluck().get(`order:${orderId}`), 0);
  const notice = sqlite().prepare('SELECT title,href FROM notifications WHERE user_id=?').get(buyer.id) as { title: string; href: string };
  assert.deepEqual(notice, { title: '课程礼物的兑换码已生成', href: '/?view=account' });
  // Other people (teachers included) never see the code.
  assert.equal((await orderDetail(person('g-teacher', { role: 'teacher' }), orderId)).gift?.code, null);
  await assert.rejects(orderDetail(person('g-other'), orderId), failure(404));
  // Redeeming needs a verified email; a wrong code is just invalid.
  const friend = person('g-friend');
  await assert.rejects(
    handleCommerce(
      new Request('http://localhost:4317/api/gifts/redeem', { method: 'POST', headers: { origin: 'http://localhost:4317' }, body: JSON.stringify({ code }) }),
      person('g-unverified', { verified: false }),
      ['gifts', 'redeem'],
    ),
    failure(403),
  );
  await assert.rejects(api(friend, 'gifts/redeem', { code: 'ABCD-EFGH-JKMN-PQRS' }), failure(404));
  const redeemed = await api(friend, 'gifts/redeem', { code: code.toLowerCase().replaceAll('-', ' ') });
  assert.deepEqual(redeemed, { courseId: 'gomall', title: 'Test course' });
  assert.equal(access(friend.email), true);
  await assert.rejects(api(person('g-late'), 'gifts/redeem', { code }), failure(404));
  const after = await orderDetail(buyer, orderId);
  assert.equal(after.gift?.code, null);
  assert.ok(after.gift?.redeemedAt);
  assert.equal(
    (sqlite().prepare('SELECT title FROM notifications WHERE user_id=? ORDER BY created_at DESC,rowid DESC').get(buyer.id) as { title: string }).title,
    '你送出的课程礼物已被兑换',
  );
  // A buyer can gift the same course again; it never blocks buying it for themselves.
  const again = await checkout(person('g-buyer2'), 'gomall', true);
  assert.ok(again.orderId);
});

void test('the buyer swaps an unused code; a learner who has the course keeps the code unused', async () => {
  const buyer = person('g-swapper');
  const { orderId, code } = await giftPaid(buyer);
  await assert.rejects(api(person('g-thief'), `gifts/${orderId}/reissue`, {}), failure(404));
  const swapped = await api(buyer, `gifts/${orderId}/reissue`, {});
  assert.notEqual(swapped.gift.code, code);
  await assert.rejects(api(person('g-old'), 'gifts/redeem', { code }), failure(404));
  const owner = person('g-owner');
  sqlite()
    .prepare("INSERT INTO grants(id,email,course_id,source,created_at) VALUES('own-g-owner',?,'gomall','instructor',?)")
    .run(owner.email, Date.now());
  await assert.rejects(api(owner, 'gifts/redeem', { code: swapped.gift.code }), failure(409));
  assert.ok((await orderDetail(buyer, orderId)).gift?.code);
});

void test('a full refund voids an unused code and takes back a redeemed one', async () => {
  const unused = await giftPaid(person('g-refund-a'));
  refundAll(unused.sessionId);
  await reconcileSession(unused.sessionId);
  assert.equal(orderRow(unused.orderId)!.status, 'refunded');
  assert.ok((await orderDetail(person('g-refund-a'), unused.orderId)).gift?.revokedAt);
  await assert.rejects(api(person('g-x'), 'gifts/redeem', { code: unused.code }), failure(404));
  await assert.rejects(api(person('g-refund-a'), `gifts/${unused.orderId}/reissue`, {}), failure(409));

  const used = await giftPaid(person('g-refund-b'));
  const friend = person('g-refund-friend');
  await api(friend, 'gifts/redeem', { code: used.code });
  assert.equal(access(friend.email), true);
  refundAll(used.sessionId);
  await reconcileSession(used.sessionId);
  assert.equal(access(friend.email), false);
});

void test('a gift session cannot pass as a purchase, nor the other way round', async () => {
  const p = person('g-tamper');
  const started = await checkout(p, 'gomall');
  const session = pay(orderRow(started.orderId)!.checkout_id!);
  session.metadata.gift = '1';
  await assert.rejects(reconcileSession(session.id, p), failure(400));
  assert.equal(access(p.email), false);
});
