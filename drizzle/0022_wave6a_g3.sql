CREATE TABLE `comment_votes` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `post_comments` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `solution_posts` ADD `anonymous` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `solution_posts` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `anonymous` integer DEFAULT 0 NOT NULL;