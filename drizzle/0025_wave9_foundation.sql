CREATE TABLE `experience_questions` (
	`submission_id` text NOT NULL,
	`idx` integer NOT NULL,
	`round` text DEFAULT '' NOT NULL,
	`problem_id` text DEFAULT '' NOT NULL,
	`similar` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`submission_id`, `idx`)
);
--> statement-breakpoint
CREATE INDEX `experience_questions_problem` ON `experience_questions` (`problem_id`);--> statement-breakpoint
CREATE TABLE `job_pay_samples` (
	`opening_id` text PRIMARY KEY NOT NULL,
	`company_slug` text NOT NULL,
	`kind` text NOT NULL,
	`role` text NOT NULL,
	`cycle` integer NOT NULL,
	`unit` text NOT NULL,
	`currency` text NOT NULL,
	`pay_min` integer NOT NULL,
	`pay_max` integer NOT NULL,
	`first_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_pay_samples_company` ON `job_pay_samples` (`company_slug`,`cycle`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `all_cases` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `prep_weeks` integer;--> statement-breakpoint
ALTER TABLE `experience_submissions` ADD `prep_sources` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `offer_deadline` integer;--> statement-breakpoint
ALTER TABLE `job_openings` ADD `auth_flags` integer DEFAULT -1 NOT NULL;