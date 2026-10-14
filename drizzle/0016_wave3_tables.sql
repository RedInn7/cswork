CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `user_id`, `kind`)
);
--> statement-breakpoint
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
CREATE INDEX `solution_posts_time` ON `solution_posts` (`created_at`);--> statement-breakpoint
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
CREATE INDEX `experience_submissions_company` ON `experience_submissions` (`company_slug`,`status`);--> statement-breakpoint
CREATE TABLE `study_group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `study_group_members_user` ON `study_group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`goal_text` text DEFAULT '' NOT NULL,
	`goal_stop` text DEFAULT '' NOT NULL,
	`goal_set_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_groups_invite_code_unique` ON `study_groups` (`invite_code`);--> statement-breakpoint
CREATE INDEX `study_groups_owner` ON `study_groups` (`owner_id`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user` ON `api_tokens` (`user_id`,`created_at`);