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
CREATE INDEX `user_marks_target` ON `user_marks` (`target`,`mark`);--> statement-breakpoint
CREATE INDEX `user_lists_fork` ON `user_lists` (`forked_from`);--> statement-breakpoint
CREATE INDEX `user_lists_public` ON `user_lists` (`visibility`,`updated_at`);