CREATE TABLE `comment_votes` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_slug` text DEFAULT '' NOT NULL,
	`company_name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`stage` text NOT NULL,
	`applied_at` integer,
	`oa_deadline` integer,
	`interview_at` integer,
	`referral` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_applications_user` ON `job_applications` (`user_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `links_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `school` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `school_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `grad_year` integer;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `target_role` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `user_profiles_school` ON `user_profiles` (`school_key`);--> statement-breakpoint
ALTER TABLE `post_comments` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `solution_posts` ADD `anonymous` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `solution_posts` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `anonymous` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_interview_scores` ADD `self_json` text;--> statement-breakpoint
CREATE INDEX `ai_interview_scores_user` ON `ai_interview_scores` (`user_id`,`created_at`);