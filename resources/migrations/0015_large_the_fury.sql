CREATE TABLE `canvas_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`from_node` text NOT NULL,
	`to_node` text NOT NULL,
	`from_side` text DEFAULT 'right' NOT NULL,
	`to_side` text DEFAULT 'left' NOT NULL,
	`label` text,
	`color` text,
	`style` text DEFAULT 'solid' NOT NULL,
	`arrow` text DEFAULT 'end' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_node`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_node`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_canvas_edges_canvas` ON `canvas_edges` (`canvas_id`);--> statement-breakpoint
CREATE TABLE `canvas_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`label` text,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_canvas_groups_canvas` ON `canvas_groups` (`canvas_id`);--> statement-breakpoint
CREATE TABLE `canvas_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`type` text NOT NULL,
	`ref_id` text,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real DEFAULT 260 NOT NULL,
	`height` real DEFAULT 160 NOT NULL,
	`color` text,
	`content` text,
	`z_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_canvas_nodes_canvas` ON `canvas_nodes` (`canvas_id`);--> statement-breakpoint
CREATE INDEX `idx_canvas_nodes_ref` ON `canvas_nodes` (`type`,`ref_id`) WHERE "canvas_nodes"."ref_id" is not null;--> statement-breakpoint
CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`viewport_x` real DEFAULT 0 NOT NULL,
	`viewport_y` real DEFAULT 0 NOT NULL,
	`viewport_zoom` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_canvases_workspace` ON `canvases` (`workspace_id`);