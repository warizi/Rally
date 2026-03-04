CREATE TABLE `entity_links` (
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`source_type`, `source_id`, `target_type`, `target_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_entity_links_target` ON `entity_links` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_links_workspace` ON `entity_links` (`workspace_id`);