CREATE TABLE `trash_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`root_entity_type` text NOT NULL,
	`root_entity_id` text NOT NULL,
	`root_title` text NOT NULL,
	`child_count` integer DEFAULT 0 NOT NULL,
	`fs_trash_path` text,
	`metadata` text,
	`deleted_at` integer NOT NULL,
	`reason` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_trash_batches_workspace_deleted` ON `trash_batches` (`workspace_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_trash_batches_root` ON `trash_batches` (`root_entity_type`,`root_entity_id`);--> statement-breakpoint
ALTER TABLE `canvas_edges` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `canvas_edges` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_canvas_edges_deleted` ON `canvas_edges` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_canvas_edges_trash_batch` ON `canvas_edges` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `canvas_groups` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `canvas_groups` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_canvas_groups_deleted` ON `canvas_groups` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_canvas_groups_trash_batch` ON `canvas_groups` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `canvas_nodes` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `canvas_nodes` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_canvas_nodes_deleted` ON `canvas_nodes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_canvas_nodes_trash_batch` ON `canvas_nodes` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `canvases` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `canvases` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_canvases_deleted` ON `canvases` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_canvases_trash_batch` ON `canvases` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `csv_files` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_csv_files_deleted` ON `csv_files` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_csv_files_trash_batch` ON `csv_files` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `folders` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `folders` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_folders_deleted` ON `folders` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_folders_trash_batch` ON `folders` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `image_files` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `image_files` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_image_files_deleted` ON `image_files` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_image_files_trash_batch` ON `image_files` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `notes` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `notes` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_notes_deleted` ON `notes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_trash_batch` ON `notes` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_pdf_files_deleted` ON `pdf_files` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_pdf_files_trash_batch` ON `pdf_files` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_recurring_rules_deleted` ON `recurring_rules` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_recurring_rules_trash_batch` ON `recurring_rules` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `schedules` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `schedules` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_schedules_deleted` ON `schedules` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_schedules_trash_batch` ON `schedules` (`trash_batch_id`);--> statement-breakpoint
ALTER TABLE `todos` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `todos` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_todos_deleted` ON `todos` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_todos_trash_batch` ON `todos` (`trash_batch_id`);