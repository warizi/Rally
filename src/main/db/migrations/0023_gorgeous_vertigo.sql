CREATE TABLE `note_style_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings_json` text NOT NULL,
	`created_at` integer NOT NULL
);
