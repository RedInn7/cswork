CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `user_id`, `kind`)
);
