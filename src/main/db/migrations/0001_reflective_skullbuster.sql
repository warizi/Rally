CREATE TABLE `tab_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`tabs_json` text NOT NULL,
	`panes_json` text NOT NULL,
	`layout_json` text NOT NULL,
	`active_pane_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
