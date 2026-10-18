CREATE TABLE `user_ai_keys` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`key_cipher` text NOT NULL,
	`key_hint` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `provider`)
);
--> statement-breakpoint
-- Each user's saved key becomes their key for that provider.
INSERT INTO `user_ai_keys` (`user_id`, `provider`, `key_cipher`, `key_hint`, `updated_at`)
SELECT `user_id`, `provider`, `key_cipher`, `key_hint`, `updated_at` FROM `user_ai`;--> statement-breakpoint
ALTER TABLE `user_ai` DROP COLUMN `key_cipher`;--> statement-breakpoint
ALTER TABLE `user_ai` DROP COLUMN `key_hint`;