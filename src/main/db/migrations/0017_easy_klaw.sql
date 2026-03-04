CREATE TABLE `item_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`tag_id` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_item_tags_item` ON `item_tags` (`item_type`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_item_tags_tag` ON `item_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_tags_item_type_tag_id_item_id_unique` ON `item_tags` (`item_type`,`tag_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_workspace_id_name_unique` ON `tags` (`workspace_id`,`name`);