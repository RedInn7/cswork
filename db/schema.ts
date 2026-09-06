import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export * from './oj-schema';
export * from './lms-schema';
export * from './commerce-schema';
export * from './media-schema';
export * from './enrollment-schema';
export * from './study-library-schema';
export * from './practice-round-schema';
import { practiceRounds } from './practice-round-schema';
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user').on(t.userId)],
);
export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    issuer: text('issuer').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    uniqueIndex('account_issuer_account_id').on(t.issuer, t.accountId),
    index('account_user').on(t.userId),
  ],
);
export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('verification_identifier').on(t.identifier)],
);
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
});
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('student'),
  createdAt: integer('created_at').notNull(),
});
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  version: text('version').notNull(),
  priceId: text('price_id'),
  published: integer('published').notNull().default(1),
  revision: integer('revision').notNull().default(1),
  position: integer('position').notNull().default(0),
});
export const lessons = sqliteTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    section: text('section').notNull(),
    position: integer('position').notNull(),
    body: text('body').notNull(),
    version: text('version').notNull(),
    streamUid: text('stream_uid'),
    videoAssetIds: text('video_asset_ids').notNull().default('[]'),
    published: integer('published').notNull().default(1),
    revision: integer('revision').notNull().default(1),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('lesson_order').on(t.courseId, t.position)],
);
export const grants = sqliteTable(
  'grants',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    courseId: text('course_id').notNull(),
    source: text('source').notNull(),
    expiresAt: integer('expires_at'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('grants_email').on(t.email)],
);
export const progress = sqliteTable(
  'progress',
  {
    userId: text('user_id').notNull(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    completed: integer('completed').notNull().default(0),
    position: real('position').notNull().default(0),
    note: text('note').notNull().default(''),
    bookmarked: integer('bookmarked').notNull().default(0),
    videoAssetId: text('video_asset_id'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('progress_user_lesson').on(t.userId, t.lessonId)],
);
export const tickets = sqliteTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    lessonId: text('lesson_id'),
    submissionId: text('submission_id'),
    videoPosition: real('video_position'),
    courseId: text('course_id'),
    videoAssetId: text('video_asset_id'),
    revision: integer('revision').notNull().default(1),
    status: text('status').notNull().default('open'),
    assignedTo: text('assigned_to'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('ticket_user').on(t.userId),
    index('ticket_status').on(t.status),
  ],
);
export const replies = sqliteTable(
  'replies',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id),
    userId: text('user_id').notNull(),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('reply_ticket').on(t.ticketId)],
);
export const releases = sqliteTable('releases', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  lessonId: text('lesson_id'),
  version: text('version').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  important: integer('important').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});
export const revisions = sqliteTable(
  'revisions',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id').notNull(),
    version: text('version').notNull(),
    body: text('body').notNull(),
    streamUid: text('stream_uid'),
    snapshotJson: text('snapshot_json'),
    createdBy: text('created_by'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('revision_version').on(t.lessonId, t.version)],
);
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href').notNull(),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('notifications_user').on(t.userId)],
);
export const releaseReads = sqliteTable(
  'release_reads',
  {
    userId: text('user_id').notNull(),
    releaseId: text('release_id').notNull(),
  },
  (t) => [uniqueIndex('release_read_user').on(t.userId, t.releaseId)],
);
export const submissions = sqliteTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    problemId: text('problem_id').notNull(),
    language: text('language').notNull(),
    code: text('code').notNull(),
    status: text('status').notNull(),
    tokens: text('tokens').notNull().default('[]'),
    passed: integer('passed').notNull().default(0),
    total: integer('total').notNull(),
    runtime: real('runtime'),
    memory: integer('memory'),
    message: text('message'),
    mode: text('mode').notNull().default('judge'),
    codingMode: text('coding_mode').notNull().default('acm'),
    harnessVersion: text('harness_version'),
    problemVersionId: text('problem_version_id'),
    practiceRoundId: text('practice_round_id').references(
      () => practiceRounds.id,
      { onDelete: 'restrict' },
    ),
    idempotencyKey: text('idempotency_key'),
    requestHash: text('request_hash'),
    customInput: text('custom_input'),
    compileOutput: text('compile_output'),
    score: integer('score').notNull().default(0),
    attempt: integer('attempt').notNull().default(0),
    cancelRequested: integer('cancel_requested').notNull().default(0),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('submission_user_time').on(t.userId, t.createdAt),
    index('submission_problem').on(t.problemId),
    index('submission_round_progress').on(
      t.userId,
      t.practiceRoundId,
      t.mode,
      t.status,
      t.problemId,
    ),
    uniqueIndex('submission_idempotency').on(t.userId, t.idempotencyKey),
    index('submission_queue').on(t.status, t.createdAt),
  ],
);
export const ojResults = sqliteTable(
  'oj_results',
  {
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    status: text('status').notNull(),
    runtimeMs: real('runtime_ms'),
    memoryKb: integer('memory_kb'),
    stdout: text('stdout'),
    stderr: text('stderr'),
    hidden: integer('hidden').notNull(),
  },
  (t) => [uniqueIndex('oj_result_case').on(t.submissionId, t.ordinal)],
);
export const ojOutbox = sqliteTable(
  'oj_outbox',
  {
    submissionId: text('submission_id')
      .primaryKey()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    dispatchedAt: integer('dispatched_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('oj_outbox_dispatch').on(t.dispatchedAt, t.createdAt)],
);
export const ojRuntime = sqliteTable('oj_runtime', {
  id: text('id').primaryKey(),
  heartbeatAt: integer('heartbeat_at').notNull(),
  healthy: integer('healthy').notNull(),
  details: text('details').notNull(),
});
// Short-lived drafts awaiting best-effort compilation; never submission history.
export const ojPrecompile = sqliteTable(
  'oj_precompile',
  {
    userId: text('user_id').primaryKey(),
    generation: text('generation').notNull(),
    problemId: text('problem_id').notNull(),
    problemVersionId: text('problem_version_id').notNull(),
    code: text('code').notNull(),
    codingMode: text('coding_mode').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('oj_precompile_expiry').on(t.expiresAt)],
);
export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    url: text('url').notNull(),
    note: text('note').notNull(),
    status: text('status').notNull().default('pending'),
    feedback: text('feedback'),
    reviewedBy: text('reviewed_by'),
    revision: integer('revision').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('review_status').on(t.status)],
);
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  courseId: text('course_id').notNull(),
  checkoutId: text('checkout_id').unique(),
  paymentIntent: text('payment_intent'),
  status: text('status').notNull(),
  amount: integer('amount'),
  currency: text('currency'),
  priceId: text('price_id'),
  updatedAt: integer('updated_at').notNull().default(0),
  paidAt: integer('paid_at'),
  amountRefunded: integer('amount_refunded').notNull().default(0),
  receiptUrl: text('receipt_url'),
  lastError: text('last_error'),
  accessRevokedAt: integer('access_revoked_at'),
  createdAt: integer('created_at').notNull(),
});
export const webhookEvents = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
});
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  targetId: text('target_id').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const limits = sqliteTable('limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    size: integer('size').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('attachment_ticket').on(t.ticketId)],
);
