ALTER TABLE `ai_interview_scores` ADD `self_json` text;--> statement-breakpoint
CREATE INDEX `ai_interview_scores_user` ON `ai_interview_scores` (`user_id`,`created_at`);