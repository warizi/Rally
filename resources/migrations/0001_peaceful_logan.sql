CREATE TABLE `tab_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`workspace_id` text NOT NULL,
	`tabs_json` text NOT NULL,
	`panes_json` text NOT NULL,
	`layout_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
