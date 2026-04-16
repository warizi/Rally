CREATE TABLE `terminal_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`layout_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terminal_layouts_workspace_id_unique` ON `terminal_layouts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `terminal_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`layout_id` text,
	`name` text NOT NULL,
	`cwd` text NOT NULL,
	`shell` text DEFAULT 'zsh' NOT NULL,
	`rows` integer DEFAULT 24 NOT NULL,
	`cols` integer DEFAULT 80 NOT NULL,
	`screen_snapshot` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`layout_id`) REFERENCES `terminal_layouts`(`id`) ON UPDATE no action ON DELETE set null
);
