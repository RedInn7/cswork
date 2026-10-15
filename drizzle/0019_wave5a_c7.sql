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
ALTER TABLE `mock_match_pairs` ADD `reminded_day_at` integer;--> statement-breakpoint
ALTER TABLE `mock_match_pairs` ADD `reminded_hour_at` integer;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `remind` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `focus_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_match_requests` ADD `instant` integer DEFAULT 0 NOT NULL;