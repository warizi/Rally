ALTER TABLE `canvases` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `canvases` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `canvases` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `canvases` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `csv_files` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `folders` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `folders` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `folders` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `folders` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `image_files` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `image_files` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `image_files` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `image_files` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `pdf_files` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_rules` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `updated_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `updated_by_id` text;