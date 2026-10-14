CREATE TABLE `course_gifts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`course_id` text NOT NULL,
	`code` text,
	`created_at` integer NOT NULL,
	`issued_at` integer,
	`redeemed_at` integer,
	`redeemed_by` text,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_gifts_code_unique` ON `course_gifts` (`code`);--> statement-breakpoint
CREATE INDEX `course_gifts_buyer` ON `course_gifts` (`buyer_id`,`created_at`);