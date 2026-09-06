import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from 'drizzle-orm/sqlite-core';

export const mediaAssets = sqliteTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    status: text('status').notNull().default('uploading'),
    duration: real('duration'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    sourceId: text('source_id').unique(),
  },
  (t) => [index('media_created').on(t.createdAt)],
);

export const mediaUploads = sqliteTable('media_uploads', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => mediaAssets.id),
  ownerId: text('owner_id').notNull(),
  offset: integer('offset').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lockToken: text('lock_token'),
  lockUntil: integer('lock_until').notNull().default(0),
});
