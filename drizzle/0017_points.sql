CREATE TABLE `point_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_once` ON `point_ledger` (`user_id`,`reason`,`ref_id`);