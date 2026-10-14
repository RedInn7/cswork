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
CREATE INDEX `user_drafts_user_time` ON `user_drafts` (`user_id`,`updated_at`);