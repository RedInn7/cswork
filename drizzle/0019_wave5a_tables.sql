CREATE TABLE `duel_queue` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` integer NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_results` (
	`room_id` text PRIMARY KEY NOT NULL,
	`a_user` text NOT NULL,
	`b_user` text NOT NULL,
	`winner` text,
	`a_before` integer NOT NULL,
	`a_after` integer NOT NULL,
	`b_before` integer NOT NULL,
	`b_after` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `duel_results_a` ON `duel_results` (`a_user`,`created_at`);--> statement-breakpoint
CREATE INDEX `duel_results_b` ON `duel_results` (`b_user`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_interview_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`level` text DEFAULT '' NOT NULL,
	`scores_json` text NOT NULL,
	`verdict` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_interview_scores_kind` ON `ai_interview_scores` (`kind`,`created_at`);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `featured_badge` text;--> statement-breakpoint
ALTER TABLE `mock_match_pairs` ADD `reminded_day_at` integer;--> statement-breakpoint
ALTER TABLE `mock_match_pairs` ADD `reminded_hour_at` integer;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `remind` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `focus_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `instant` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contest_entries` ADD `share_code` integer DEFAULT 0 NOT NULL;