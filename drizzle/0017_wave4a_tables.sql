CREATE TABLE `user_drafts` (
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`language` text NOT NULL,
	`coding_mode` text NOT NULL,
	`code` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `problem_id`, `language`, `coding_mode`)
);
--> statement-breakpoint
CREATE INDEX `user_drafts_user_time` ON `user_drafts` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `point_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_once` ON `point_ledger` (`user_id`,`reason`,`ref_id`);--> statement-breakpoint
CREATE TABLE `user_follows` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`)
);
--> statement-breakpoint
CREATE INDEX `user_follows_followee` ON `user_follows` (`followee_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `solution_posts` ADD `tag` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `solution_posts_tag` ON `solution_posts` (`problem_id`,`tag`,`created_at`);--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `difficulty` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `sentiment` text;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `channel` text;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `employment` text;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `season` text;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `location` text;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `duration_weeks` integer;--> statement-breakpoint
CREATE INDEX `user_marks_target_mark` ON `user_marks` (`target`,`mark`);--> statement-breakpoint
CREATE INDEX `user_lists_fork` ON `user_lists` (`forked_from`);--> statement-breakpoint
CREATE INDEX `user_lists_public` ON `user_lists` (`visibility`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_user` ON `ai_usage` (`user_id`);