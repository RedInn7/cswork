CREATE TABLE `poll_votes` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`option` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`, `option`)
);
--> statement-breakpoint
CREATE TABLE `post_polls` (
	`post_id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`options_json` text NOT NULL,
	`multi` integer DEFAULT 0 NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL
);
