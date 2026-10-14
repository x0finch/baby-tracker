CREATE TABLE `invites` (
	`code` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`role` text NOT NULL,
	`baby_ids` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invites_family_idx` ON `invites` (`family_id`);