CREATE TABLE `ai_shares` (
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`family_id`, `user_id`),
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_interrupts` (
	`interrupt_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`status` text NOT NULL,
	`requested_at` integer NOT NULL,
	`resolved_at` integer,
	`payload_json` text NOT NULL,
	`response_json` text
);
--> statement-breakpoint
CREATE INDEX `chat_interrupts_thread` ON `chat_interrupts` (`thread_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `chat_interrupts_run` ON `chat_interrupts` (`run_id`);--> statement-breakpoint
CREATE TABLE `chat_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error` text,
	`error_code` text,
	`usage_json` text,
	`sandbox_key` text,
	`detached_since` integer,
	`cancel_requested` integer,
	`driver_epoch` integer,
	`parent_run_id` text,
	`subagent_run_id` text,
	`name` text
);
--> statement-breakpoint
CREATE INDEX `chat_runs_thread_status` ON `chat_runs` (`thread_id`,`status`);--> statement-breakpoint
CREATE INDEX `chat_runs_thread_started` ON `chat_runs` (`thread_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`messages_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_ai` (
	`family_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_ai` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`key_cipher` text NOT NULL,
	`key_hint` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voice_ops` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`run_id` text NOT NULL,
	`event_id` text NOT NULL,
	`before` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_ops_thread_idx` ON `voice_ops` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `voice_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`phrase` text NOT NULL,
	`time_zone` text NOT NULL,
	`thread_id` text,
	`thread_active_at` integer,
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
CREATE UNIQUE INDEX `voice_tokens_user_idx` ON `voice_tokens` (`user_id`);