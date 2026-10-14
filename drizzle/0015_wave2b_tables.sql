CREATE TABLE `mock_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company` text,
	`name` text,
	`platform` text,
	`preset` integer NOT NULL,
	`scoring` text NOT NULL,
	`source` text NOT NULL,
	`set_hash` text NOT NULL,
	`ids_json` text NOT NULL,
	`slots_json` text NOT NULL,
	`minutes` integer NOT NULL,
	`skew` integer NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`reason` text NOT NULL,
	`score` integer,
	`max` integer,
	`solved` integer,
	`estimate` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_sessions_user_time` ON `mock_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `mock_sessions_set` ON `mock_sessions` (`set_hash`);--> statement-breakpoint
CREATE TABLE `problem_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`round` text DEFAULT '' NOT NULL,
	`asked_month` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problem_reports_once` ON `problem_reports` (`user_id`,`problem_id`,`asked_month`);--> statement-breakpoint
CREATE INDEX `problem_reports_problem` ON `problem_reports` (`problem_id`,`asked_month`);--> statement-breakpoint
CREATE INDEX `problem_reports_company` ON `problem_reports` (`company`,`asked_month`);--> statement-breakpoint
CREATE INDEX `problem_reports_user_time` ON `problem_reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_list_items` (
	`list_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`list_id`, `problem_id`)
);
--> statement-breakpoint
CREATE TABLE `user_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`forked_from` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_lists_owner` ON `user_lists` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`visible` integer DEFAULT 0 NOT NULL,
	`indexable` integer DEFAULT 0 NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_handle_unique` ON `user_profiles` (`handle`);