CREATE TABLE `embedding_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`rowid` integer NOT NULL,
	`content_hash` text NOT NULL,
	`model` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_embedding_meta_entity` ON `embedding_meta` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_embedding_meta_rowid` ON `embedding_meta` (`rowid`);--> statement-breakpoint
CREATE INDEX `idx_embedding_meta_workspace` ON `embedding_meta` (`workspace_id`);