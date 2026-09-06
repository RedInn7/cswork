CREATE TABLE `oj_precompile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`generation` text NOT NULL,
	`problem_id` text NOT NULL,
	`problem_version_id` text NOT NULL,
	`code` text NOT NULL,
	`coding_mode` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oj_precompile_expiry` ON `oj_precompile` (`expires_at`);