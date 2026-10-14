CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`on_profile` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_user_course` ON `certificates` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `mock_match_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`level` text NOT NULL,
	`slot` integer NOT NULL,
	`seed` text NOT NULL,
	`a_user` text NOT NULL,
	`a_name` text NOT NULL,
	`b_user` text NOT NULL,
	`b_name` text NOT NULL,
	`meet_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`a_no_show_at` integer,
	`b_no_show_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_pairs_a` ON `mock_match_pairs` (`a_user`,`slot`);--> statement-breakpoint
CREATE INDEX `mock_pairs_b` ON `mock_match_pairs` (`b_user`,`slot`);--> statement-breakpoint
CREATE TABLE `mock_match_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`kind` text NOT NULL,
	`level` text NOT NULL,
	`slots_json` text NOT NULL,
	`tz` integer DEFAULT 0 NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`pair_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mock_match_open` ON `mock_match_requests` (`status`,`kind`,`level`);--> statement-breakpoint
CREATE INDEX `mock_match_user` ON `mock_match_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `study_group_camps` (
	`group_id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`per_day` integer NOT NULL,
	`start_date` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `newsletter_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` integer NOT NULL,
	`data_json` text NOT NULL,
	`composed_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE TABLE `newsletter_subs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`token` text NOT NULL,
	`subscribed_at` integer NOT NULL,
	`confirmed_at` integer,
	`confirm_sent_at` integer,
	`unsubscribed_at` integer,
	`last_issue` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subs_token_unique` ON `newsletter_subs` (`token`);--> statement-breakpoint
CREATE TABLE `course_gifts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`course_id` text NOT NULL,
	`code` text,
	`created_at` integer NOT NULL,
	`issued_at` integer,
	`redeemed_at` integer,
	`redeemed_by` text,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_gifts_code_unique` ON `course_gifts` (`code`);--> statement-breakpoint
CREATE INDEX `course_gifts_buyer` ON `course_gifts` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contest_entries` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` integer NOT NULL,
	`virtual_start` integer,
	PRIMARY KEY(`room_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `contest_entries_user` ON `contest_entries` (`user_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `contest_ratings` (
	`user_id` text NOT NULL,
	`room_id` text NOT NULL,
	`before` integer NOT NULL,
	`after` integer NOT NULL,
	`rank` integer NOT NULL,
	`entrants` integer NOT NULL,
	`solved` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `room_id`)
);
--> statement-breakpoint
CREATE INDEX `contest_ratings_room` ON `contest_ratings` (`room_id`);--> statement-breakpoint
CREATE TABLE `contest_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`problem_ids_json` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`invite_code` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`rated_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_rooms_invite_code_unique` ON `contest_rooms` (`invite_code`);--> statement-breakpoint
CREATE INDEX `contest_rooms_kind_start` ON `contest_rooms` (`kind`,`starts_at`);--> statement-breakpoint
CREATE INDEX `contest_rooms_owner` ON `contest_rooms` (`owner_id`);--> statement-breakpoint
ALTER TABLE `courses` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `level` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `show_contest` integer DEFAULT 0 NOT NULL;