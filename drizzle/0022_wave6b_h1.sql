CREATE TABLE `company_follows` (
	`user_id` text NOT NULL,
	`company_slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_digest_at` integer,
	PRIMARY KEY(`user_id`, `company_slug`)
);
--> statement-breakpoint
CREATE INDEX `company_follows_company` ON `company_follows` (`company_slug`);--> statement-breakpoint
CREATE TABLE `notify_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`review` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 1 NOT NULL,
	`daily` integer DEFAULT 0 NOT NULL,
	`contest` integer DEFAULT 1 NOT NULL,
	`email` integer DEFAULT 0 NOT NULL,
	`hour` integer DEFAULT 20 NOT NULL,
	`tz` integer DEFAULT 0 NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`token` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notify_prefs_token_unique` ON `notify_prefs` (`token`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user` ON `push_subscriptions` (`user_id`);