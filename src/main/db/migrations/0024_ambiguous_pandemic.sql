DROP INDEX `csv_files_workspace_id_relative_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_csv_files_active_path` ON `csv_files` (`workspace_id`,`relative_path`) WHERE "csv_files"."deleted_at" is null;--> statement-breakpoint
DROP INDEX `folders_workspace_id_relative_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_folders_active_path` ON `folders` (`workspace_id`,`relative_path`) WHERE "folders"."deleted_at" is null;--> statement-breakpoint
DROP INDEX `image_files_workspace_id_relative_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_image_files_active_path` ON `image_files` (`workspace_id`,`relative_path`) WHERE "image_files"."deleted_at" is null;--> statement-breakpoint
DROP INDEX `notes_workspace_id_relative_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_notes_active_path` ON `notes` (`workspace_id`,`relative_path`) WHERE "notes"."deleted_at" is null;--> statement-breakpoint
DROP INDEX `pdf_files_workspace_id_relative_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_pdf_files_active_path` ON `pdf_files` (`workspace_id`,`relative_path`) WHERE "pdf_files"."deleted_at" is null;