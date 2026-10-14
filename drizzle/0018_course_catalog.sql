CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`on_profile` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_user_course` ON `certificates` (`user_id`,`course_id`);--> statement-breakpoint
ALTER TABLE `courses` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `level` text DEFAULT '' NOT NULL;