CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '할일' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`is_done` integer DEFAULT false NOT NULL,
	`list_order` real DEFAULT 0 NOT NULL,
	`kanban_order` real DEFAULT 0 NOT NULL,
	`sub_order` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`done_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
