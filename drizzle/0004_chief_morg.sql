CREATE TABLE `lms_grant_requests` (
	`actor_id` text NOT NULL,
	`key` text NOT NULL,
	`payload_json` text NOT NULL,
	`grant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`actor_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_drafts` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer NOT NULL,
	`base_revision` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lms_draft_revision" CHECK("lms_lesson_drafts"."revision">0),
	CONSTRAINT "lms_draft_json" CHECK(json_valid("lms_lesson_drafts"."payload_json"))
);
--> statement-breakpoint
CREATE TABLE `lms_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`note` text NOT NULL,
	`feedback` text,
	`status` text NOT NULL,
	`lesson_version` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lms_review_revision` ON `lms_review_events` (`review_id`,`revision`);--> statement-breakpoint
CREATE INDEX `lms_review_event_time` ON `lms_review_events` (`review_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `commerce_checkout_locks` (
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`order_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `course_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_checkout_locks_order_id_unique` ON `commerce_checkout_locks` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stripe_refund_id` text,
	`idempotency_key` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_refunds_stripe_refund_id_unique` ON `order_refunds` (`stripe_refund_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_refunds_idempotency_key_unique` ON `order_refunds` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `order_refund_order` ON `order_refunds` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`duration` real,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`source_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_storage_key_unique` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_source_id_unique` ON `media_assets` (`source_id`);--> statement-breakpoint
CREATE INDEX `media_created` ON `media_assets` (`created_at`);--> statement-breakpoint
CREATE TABLE `media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`offset` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`lock_token` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `enrollment_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`course_ids` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`redeemed_at` integer,
	`redeemed_by` text,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollment_invites_token_hash_unique` ON `enrollment_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invite_email` ON `enrollment_invites` (`email`);--> statement-breakpoint
CREATE INDEX `invite_created` ON `enrollment_invites` (`created_at`);--> statement-breakpoint
ALTER TABLE `courses` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `video_asset_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `published` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `price_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `amount_refunded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `receipt_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `access_revoked_at` integer;--> statement-breakpoint
ALTER TABLE `progress` ADD `video_asset_id` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `revisions` ADD `snapshot_json` text;--> statement-breakpoint
ALTER TABLE `revisions` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `course_id` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `revision` integer DEFAULT 1 NOT NULL;