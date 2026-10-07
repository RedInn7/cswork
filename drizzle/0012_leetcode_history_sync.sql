CREATE TABLE `leetcode_accepted_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`region` text NOT NULL,
	`external_username` text NOT NULL,
	`external_submission_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`language` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`source_url` text NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leetcode_accepted_external` ON `leetcode_accepted_records` (`user_id`,`region`,`external_username`,`external_submission_id`);--> statement-breakpoint
CREATE INDEX `leetcode_accepted_user_slug` ON `leetcode_accepted_records` (`user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `leetcode_accepted_user_time` ON `leetcode_accepted_records` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `leetcode_round_records` (
	`user_id` text NOT NULL,
	`round_id` text NOT NULL,
	`record_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `practice_rounds`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`record_id`) REFERENCES `leetcode_accepted_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leetcode_round_record` ON `leetcode_round_records` (`user_id`,`round_id`,`record_id`);--> statement-breakpoint
CREATE TABLE `leetcode_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`region` text NOT NULL,
	`external_username` text NOT NULL,
	`round_id` text NOT NULL,
	`status` text NOT NULL,
	`offset` integer DEFAULT 0 NOT NULL,
	`last_key` text DEFAULT '' NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`scanned` integer DEFAULT 0 NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`matched` integer DEFAULT 0 NOT NULL,
	`unmatched` integer DEFAULT 0 NOT NULL,
	`error` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `practice_rounds`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leetcode_sync_request` ON `leetcode_sync_runs` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `leetcode_sync_user_time` ON `leetcode_sync_runs` (`user_id`,`created_at`);