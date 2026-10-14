CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`family_id`, `user_id`),
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `sync_seq` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX `babies_family_idx`;--> statement-breakpoint
ALTER TABLE `babies` ADD `seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `babies_family_seq_idx` ON `babies` (`family_id`,`seq`,`id`);--> statement-breakpoint
DROP INDEX `events_family_idx`;--> statement-breakpoint
ALTER TABLE `events` ADD `seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `events_family_seq_idx` ON `events` (`family_id`,`seq`,`id`);--> statement-breakpoint
INSERT INTO `sync_seq` (`id`, `value`) VALUES (1, 0);
