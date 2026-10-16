CREATE TABLE `practice_aids` (
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `problem_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `job_openings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_slug` text NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`posted_at` integer,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_openings_company` ON `job_openings` (`company_slug`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `job_openings_first_seen` ON `job_openings` (`first_seen_at`);--> statement-breakpoint
CREATE TABLE `code_review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`line` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `code_review_comments_review` ON `code_review_comments` (`review_id`);--> statement-breakpoint
CREATE TABLE `code_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_reviews_token_hash_unique` ON `code_reviews` (`token_hash`);--> statement-breakpoint
CREATE INDEX `code_reviews_owner` ON `code_reviews` (`owner_id`);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `show_practice` integer DEFAULT 0 NOT NULL;