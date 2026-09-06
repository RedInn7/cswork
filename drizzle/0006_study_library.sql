CREATE TABLE `study_library` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`slug` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`difficulty` text NOT NULL,
	`topics_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`case_count` integer NOT NULL,
	`expected_count` integer NOT NULL,
	`judge_problem_id` text,
	`verified_hash` text,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_library_slug_unique` ON `study_library` (`slug`);--> statement-breakpoint
CREATE INDEX `study_library_number` ON `study_library` (`number`);