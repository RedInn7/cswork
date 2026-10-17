CREATE TABLE `resume_review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	`original` text NOT NULL,
	`body` text NOT NULL,
	`suggestion` text DEFAULT '' NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `resume_review_comments_review` ON `resume_review_comments` (`review_id`);--> statement-breakpoint
CREATE TABLE `resume_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_reviews_token_hash_unique` ON `resume_reviews` (`token_hash`);--> statement-breakpoint
CREATE INDEX `resume_reviews_owner` ON `resume_reviews` (`owner_id`);--> statement-breakpoint
ALTER TABLE `job_applications` ADD `tier` text DEFAULT '' NOT NULL;