import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Personal access tokens for the MCP server (lib/server/api-tokens.ts). Only the
// SHA-256 of the token is stored; revoking sets revoked_at. No foreign keys:
// release.sh only applies additive SQL.
export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    revokedAt: integer('revoked_at'),
  },
  (t) => [index('api_tokens_user').on(t.userId, t.createdAt)],
);
