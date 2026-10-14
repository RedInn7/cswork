CREATE TABLE `experience_flags` (
	`submission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`submission_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `experience_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_slug` text NOT NULL,
	`title` text NOT NULL,
	`role` text NOT NULL,
	`rounds` text DEFAULT '[]' NOT NULL,
	`result` text,
	`interview_month` text NOT NULL,
	`body` text NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `experience_submissions_user` ON `experience_submissions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `experience_submissions_status` ON `experience_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `experience_submissions_company` ON `experience_submissions` (`company_slug`,`status`);