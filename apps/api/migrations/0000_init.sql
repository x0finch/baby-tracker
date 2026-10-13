CREATE TABLE `babies` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`sex` text NOT NULL,
	`avatar_color` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `babies_family_idx` ON `babies` (`family_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`family_id` text,
	`type` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	`data` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `events_baby_start_idx` ON `events` (`baby_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `events_family_idx` ON `events` (`family_id`);