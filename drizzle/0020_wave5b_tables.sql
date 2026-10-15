CREATE TABLE `poll_votes` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`option` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`, `option`)
);
--> statement-breakpoint
CREATE TABLE `post_polls` (
	`post_id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`options_json` text NOT NULL,
	`multi` integer DEFAULT 0 NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread` text NOT NULL,
	`from_user` text NOT NULL,
	`to_user` text NOT NULL,
	`body` text NOT NULL,
	`post_id` text,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE INDEX `direct_messages_thread` ON `direct_messages` (`thread`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_to` ON `direct_messages` (`to_user`,`read_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_from` ON `direct_messages` (`from_user`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_time` ON `direct_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `dm_blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `dm_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`open` text DEFAULT 'all' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_group_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `study_group_messages_group` ON `study_group_messages` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `study_group_messages_time` ON `study_group_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `work_verifications` (
	`user_id` text PRIMARY KEY NOT NULL,
	`company_slug` text NOT NULL,
	`domain` text NOT NULL,
	`email_hash` text NOT NULL,
	`code_hash` text,
	`code_expires_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`show_profile` integer DEFAULT 0 NOT NULL,
	`show_posts` integer DEFAULT 0 NOT NULL,
	`show_referrals` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_verifications_email` ON `work_verifications` (`email_hash`) WHERE "work_verifications"."verified_at" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `skill_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`test` text NOT NULL,
	`ids_json` text NOT NULL,
	`language` text,
	`started_at` integer NOT NULL,
	`deadline` integer NOT NULL,
	`finished_at` integer,
	`score` integer,
	`max` integer,
	`passed` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skill_attempts_user_test` ON `skill_attempts` (`user_id`,`test`);--> statement-breakpoint
CREATE TABLE `course_ratings` (
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`stars` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `course_id`)
);
--> statement-breakpoint
CREATE INDEX `course_ratings_course` ON `course_ratings` (`course_id`);