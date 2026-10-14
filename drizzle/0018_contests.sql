CREATE TABLE `contest_entries` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` integer NOT NULL,
	`virtual_start` integer,
	PRIMARY KEY(`room_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `contest_entries_user` ON `contest_entries` (`user_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `contest_ratings` (
	`user_id` text NOT NULL,
	`room_id` text NOT NULL,
	`before` integer NOT NULL,
	`after` integer NOT NULL,
	`rank` integer NOT NULL,
	`entrants` integer NOT NULL,
	`solved` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `room_id`)
);
--> statement-breakpoint
CREATE INDEX `contest_ratings_room` ON `contest_ratings` (`room_id`);--> statement-breakpoint
CREATE TABLE `contest_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`problem_ids_json` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`invite_code` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`rated_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_rooms_invite_code_unique` ON `contest_rooms` (`invite_code`);--> statement-breakpoint
CREATE INDEX `contest_rooms_kind_start` ON `contest_rooms` (`kind`,`starts_at`);--> statement-breakpoint
CREATE INDEX `contest_rooms_owner` ON `contest_rooms` (`owner_id`);