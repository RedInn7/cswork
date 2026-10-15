CREATE TABLE `job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_slug` text DEFAULT '' NOT NULL,
	`company_name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`stage` text NOT NULL,
	`applied_at` integer,
	`oa_deadline` integer,
	`interview_at` integer,
	`referral` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_applications_user` ON `job_applications` (`user_id`,`updated_at`);