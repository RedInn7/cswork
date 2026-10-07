CREATE TABLE `leetcode_sync_seen` (
	`run_id` text NOT NULL,
	`external_submission_id` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `leetcode_sync_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leetcode_sync_seen_record` ON `leetcode_sync_seen` (`run_id`,`external_submission_id`);