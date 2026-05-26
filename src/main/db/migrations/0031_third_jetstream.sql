ALTER TABLE `canvases` ADD `is_locked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `is_locked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `is_locked` integer DEFAULT 0 NOT NULL;
