CREATE TABLE `oj_outbox` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`dispatched_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oj_results` (
	`submission_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`status` text NOT NULL,
	`runtime_ms` real,
	`memory_kb` integer,
	`stdout` text,
	`stderr` text,
	`hidden` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oj_result_case` ON `oj_results` (`submission_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `oj_runtime` (
	`id` text PRIMARY KEY NOT NULL,
	`heartbeat_at` integer NOT NULL,
	`healthy` integer NOT NULL,
	`details` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oj_problem_drafts` (
	`problem_id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `oj_problems`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "oj_draft_positive_revision" CHECK("oj_problem_drafts"."revision" > 0),
	CONSTRAINT "oj_draft_valid_payload" CHECK(json_valid("oj_problem_drafts"."payload_json"))
);
--> statement-breakpoint
CREATE TABLE `oj_problem_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_id` text NOT NULL,
	`revision` integer NOT NULL,
	`spec_json` text NOT NULL,
	`checksum` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `oj_problems`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "oj_version_positive_revision" CHECK("oj_problem_versions"."revision" > 0),
	CONSTRAINT "oj_version_valid_spec" CHECK(json_valid("oj_problem_versions"."spec_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oj_version_revision` ON `oj_problem_versions` (`problem_id`,`revision`);--> statement-breakpoint
CREATE TABLE `oj_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`current_version_id` text,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "oj_problem_published_boolean" CHECK("oj_problems"."published" IN (0,1)),
	CONSTRAINT "oj_problem_published_version" CHECK("oj_problems"."published" = 0 OR "oj_problems"."current_version_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `oj_problem_course` ON `oj_problems` (`course_id`,`published`);--> statement-breakpoint
CREATE TABLE `oj_test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`input` text NOT NULL,
	`expected_output` text NOT NULL,
	`hidden` integer NOT NULL,
	`name` text NOT NULL,
	`weight` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `oj_problem_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "oj_case_ordinal_nonnegative" CHECK("oj_test_cases"."ordinal" >= 0),
	CONSTRAINT "oj_case_hidden_boolean" CHECK("oj_test_cases"."hidden" IN (0,1)),
	CONSTRAINT "oj_case_weight_valid" CHECK("oj_test_cases"."weight" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oj_case_ordinal` ON `oj_test_cases` (`version_id`,`ordinal`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `mode` text DEFAULT 'judge' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `problem_version_id` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `request_hash` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `custom_input` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `compile_output` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `attempt` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `cancel_requested` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `started_at` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `finished_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `submission_idempotency` ON `submissions` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `submission_queue` ON `submissions` (`status`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `oj_version_immutable_update` BEFORE UPDATE ON `oj_problem_versions`
BEGIN SELECT RAISE(ABORT, 'Published problem versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `oj_version_immutable_delete` BEFORE DELETE ON `oj_problem_versions`
BEGIN SELECT RAISE(ABORT, 'Published problem versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `oj_case_immutable_update` BEFORE UPDATE ON `oj_test_cases`
BEGIN SELECT RAISE(ABORT, 'Published test cases are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `oj_case_immutable_delete` BEFORE DELETE ON `oj_test_cases`
BEGIN SELECT RAISE(ABORT, 'Published test cases are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `oj_case_sealed_insert` BEFORE INSERT ON `oj_test_cases`
WHEN EXISTS (
  SELECT 1 FROM oj_problem_versions target
  JOIN oj_problems p ON p.id=target.problem_id
  JOIN oj_problem_versions current ON current.id=p.current_version_id
  WHERE target.id=NEW.version_id AND current.revision >= target.revision
) OR EXISTS (SELECT 1 FROM submissions WHERE problem_version_id=NEW.version_id)
BEGIN SELECT RAISE(ABORT, 'Cannot append test cases to a sealed problem version'); END;
--> statement-breakpoint
CREATE TRIGGER `oj_problem_version_pointer` BEFORE UPDATE OF current_version_id ON `oj_problems`
WHEN (OLD.current_version_id IS NOT NULL AND NEW.current_version_id IS NULL)
OR (NEW.current_version_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM oj_problem_versions v
  WHERE v.id=NEW.current_version_id AND v.problem_id=NEW.id
  AND (OLD.current_version_id IS NULL OR v.revision >= (
    SELECT previous.revision FROM oj_problem_versions previous WHERE previous.id=OLD.current_version_id
  ))
))
BEGIN SELECT RAISE(ABORT, 'Current version must belong to the problem and cannot move backwards'); END;
