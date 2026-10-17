CREATE TABLE `voice_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`phrase` text NOT NULL,
	`time_zone` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voice_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`expires_at` integer NOT NULL,
	`day` text DEFAULT '' NOT NULL,
	`day_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_tokens_hash_idx` ON `voice_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `voice_tokens_user_idx` ON `voice_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `voice_undo` (
	`user_id` text PRIMARY KEY NOT NULL,
	`changes` text NOT NULL,
	`created_at` integer NOT NULL
);
