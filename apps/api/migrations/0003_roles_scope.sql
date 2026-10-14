CREATE TABLE `membership_babies` (
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`baby_id` text NOT NULL,
	PRIMARY KEY(`family_id`, `user_id`, `baby_id`)
);
--> statement-breakpoint
ALTER TABLE `memberships` ADD `baby_scope` text DEFAULT 'all' NOT NULL;