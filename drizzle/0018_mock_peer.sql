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
CREATE INDEX `mock_match_user` ON `mock_match_requests` (`user_id`,`created_at`);