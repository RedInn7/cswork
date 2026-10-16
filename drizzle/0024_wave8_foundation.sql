CREATE TABLE `job_seasons` (
	`company_slug` text NOT NULL,
	`kind` text NOT NULL,
	`cycle` integer NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`peak` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`company_slug`, `kind`, `cycle`)
);
--> statement-breakpoint
CREATE TABLE `career_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`how_met` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`last_contact_at` integer,
	`next_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`application_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `career_contacts_user` ON `career_contacts` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `mcq_answers` (
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`picks` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`question_id`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `oa_solved` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `oa_total` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `oa_tests_pct` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `oa_minutes` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `oa_next` text;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `stage_log` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `channel` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `referral_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `next_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `next_at` integer;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `jd_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `resume_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notify_prefs` ADD `applications` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `job_openings` ADD `pay_min` integer;--> statement-breakpoint
ALTER TABLE `job_openings` ADD `pay_max` integer;--> statement-breakpoint
ALTER TABLE `job_openings` ADD `pay_currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_openings` ADD `pay_unit` text DEFAULT '' NOT NULL;