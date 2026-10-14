CREATE TABLE `newsletter_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` integer NOT NULL,
	`data_json` text NOT NULL,
	`composed_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE TABLE `newsletter_subs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`token` text NOT NULL,
	`subscribed_at` integer NOT NULL,
	`confirmed_at` integer,
	`confirm_sent_at` integer,
	`unsubscribed_at` integer,
	`last_issue` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subs_token_unique` ON `newsletter_subs` (`token`);