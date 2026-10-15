CREATE TABLE `skill_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`test` text NOT NULL,
	`ids_json` text NOT NULL,
	`language` text,
	`started_at` integer NOT NULL,
	`deadline` integer NOT NULL,
	`finished_at` integer,
	`score` integer,
	`max` integer,
	`passed` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skill_attempts_user_test` ON `skill_attempts` (`user_id`,`test`);--> statement-breakpoint
CREATE TABLE `course_ratings` (
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`stars` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `course_id`)
);
--> statement-breakpoint
CREATE INDEX `course_ratings_course` ON `course_ratings` (`course_id`);