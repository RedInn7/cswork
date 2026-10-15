ALTER TABLE `user_profiles` ADD `links_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `school` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `school_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `grad_year` integer;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `target_role` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `user_profiles_school` ON `user_profiles` (`school_key`);