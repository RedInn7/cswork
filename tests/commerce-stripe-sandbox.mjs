// Real Stripe API validation: creates and expires a sandbox Checkout Session. Never charges a card.
// node --env-file=.local/stripe-sandbox.env --import tsx tests/commerce-stripe-sandbox.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
if (
  !process.env.STRIPE_SECRET_KEY?.includes('_test_') ||
  !process.env.STRIPE_PRICE_GOMALL
)
  throw new Error(
    'Requires the dedicated cswork test sandbox and its test Price',
  );
const directory = mkdtempSync(resolve(tmpdir(), 'cswork-stripe-real-'));
process.env.DATABASE_PATH = resolve(directory, 'test.sqlite');
process.env.APP_URL = 'http://localhost:4317';
process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_api_validation_only';
delete process.env.STRIPE_API_BASE_URL;
const { sqlite } = await import('../db/sqlite.ts');
const { checkout, validPrice, orderRow, reconcileSession, stripeClient } =
  await import('../lib/server/payments.ts');
let session;
try {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare(
      "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Sandbox test','','1',1)",
    )
    .run();
  const price = await validPrice(process.env.STRIPE_PRICE_GOMALL, true);
  assert.equal(price.livemode, false);
  assert.equal(price.unit_amount, 100);
  const person = {
    id: 'sandbox-validation',
    email: 'cswork-validation@example.test',
    name: 'Validation',
    verified: true,
    role: 'student',
  };
  const created = await checkout(person, 'gomall');
  session = orderRow(created.orderId).checkout_id;
  assert.ok(created.url.startsWith('https://checkout.stripe.com/'));
  const repeat = await checkout(person, 'gomall');
  assert.equal(repeat.orderId, created.orderId);
  assert.equal(repeat.url, created.url);
  await stripeClient().checkout.sessions.expire(session);
  const expired = await reconcileSession(session, person);
  assert.equal(expired.status, 'expired');
  console.log(
    'PASS real Stripe sandbox: validated Price, created hosted Checkout, reused one order, expired session and reconciled state. No payment was charged.',
  );
} finally {
  if (session)
    await stripeClient()
      .checkout.sessions.expire(session)
      .catch(() => {});
  sqlite().close();
  rmSync(directory, { recursive: true, force: true });
}
