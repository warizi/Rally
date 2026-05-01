ALTER TABLE `templates` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `templates` ADD `trash_batch_id` text REFERENCES trash_batches(id);--> statement-breakpoint
CREATE INDEX `idx_templates_deleted` ON `templates` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_templates_trash_batch` ON `templates` (`trash_batch_id`);