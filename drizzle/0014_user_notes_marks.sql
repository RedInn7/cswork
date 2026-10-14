CREATE TABLE `user_marks` (
	`user_id` text NOT NULL,
	`target` text NOT NULL,
	`mark` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target`, `mark`)
);
--> statement-breakpoint
CREATE TABLE `user_notes` (
	`user_id` text NOT NULL,
	`target` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target`)
);
