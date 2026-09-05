CREATE TABLE `account_with_issuer` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `issuer` text NOT NULL,
  `user_id` text NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `id_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `password` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `account_with_issuer`
  (`id`,`account_id`,`provider_id`,`issuer`,`user_id`,`access_token`,`refresh_token`,`id_token`,`access_token_expires_at`,`refresh_token_expires_at`,`scope`,`password`,`created_at`,`updated_at`)
SELECT `id`,`account_id`,`provider_id`,
  CASE WHEN `provider_id`='credential' THEN 'local:credential' ELSE 'local:oauth:' || `provider_id` END,
  `user_id`,`access_token`,`refresh_token`,`id_token`,`access_token_expires_at`,`refresh_token_expires_at`,`scope`,`password`,`created_at`,`updated_at`
FROM `account`;
--> statement-breakpoint
DROP TABLE `account`;
--> statement-breakpoint
ALTER TABLE `account_with_issuer` RENAME TO `account`;
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id` ON `account` (`issuer`,`account_id`);
--> statement-breakpoint
CREATE INDEX `account_user` ON `account` (`user_id`);
