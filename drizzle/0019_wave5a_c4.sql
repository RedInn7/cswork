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
ALTER TABLE `contest_entries` ADD `share_code` integer DEFAULT 0 NOT NULL;