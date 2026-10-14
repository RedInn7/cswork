CREATE TABLE `study_group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `study_group_members_user` ON `study_group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`goal_text` text DEFAULT '' NOT NULL,
	`goal_stop` text DEFAULT '' NOT NULL,
	`goal_set_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_groups_invite_code_unique` ON `study_groups` (`invite_code`);--> statement-breakpoint
CREATE INDEX `study_groups_owner` ON `study_groups` (`owner_id`);