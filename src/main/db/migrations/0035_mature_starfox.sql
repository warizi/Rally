ALTER TABLE `csv_files` ADD `ino` text;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `dev` text;--> statement-breakpoint
CREATE INDEX `idx_csv_files_ino` ON `csv_files` (`workspace_id`,`ino`);--> statement-breakpoint
ALTER TABLE `folders` ADD `ino` text;--> statement-breakpoint
ALTER TABLE `folders` ADD `dev` text;--> statement-breakpoint
CREATE INDEX `idx_folders_ino` ON `folders` (`workspace_id`,`ino`);--> statement-breakpoint
ALTER TABLE `image_files` ADD `ino` text;--> statement-breakpoint
ALTER TABLE `image_files` ADD `dev` text;--> statement-breakpoint
CREATE INDEX `idx_image_files_ino` ON `image_files` (`workspace_id`,`ino`);--> statement-breakpoint
ALTER TABLE `notes` ADD `ino` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `dev` text;--> statement-breakpoint
CREATE INDEX `idx_notes_ino` ON `notes` (`workspace_id`,`ino`);--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `ino` text;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `dev` text;--> statement-breakpoint
CREATE INDEX `idx_pdf_files_ino` ON `pdf_files` (`workspace_id`,`ino`);