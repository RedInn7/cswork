CREATE TABLE `post_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_comments_post` ON `post_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_comments_user_time` ON `post_comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_comments_time` ON `post_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_reports` (
	`target` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`target`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `post_reports_user_time` ON `post_reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_votes` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `solution_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `solution_posts_problem` ON `solution_posts` (`problem_id`,`hidden`,`created_at`);--> statement-breakpoint
CREATE INDEX `solution_posts_user_time` ON `solution_posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `solution_posts_time` ON `solution_posts` (`created_at`);