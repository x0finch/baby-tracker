CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`user_id` text NOT NULL,
	`baby_id` text NOT NULL,
	`kind` text NOT NULL,
	`interval_minutes` integer NOT NULL,
	`enabled` integer NOT NULL,
	`fired_for` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `baby_id`, `kind`)
);
--> statement-breakpoint
CREATE INDEX `reminders_enabled_idx` ON `reminders` (`enabled`);--> statement-breakpoint
CREATE TABLE `server_keys` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL
);
