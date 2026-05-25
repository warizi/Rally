CREATE TABLE `custom_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`content` text NOT NULL,
	`mcp_tools_json` text DEFAULT '[]' NOT NULL,
	`triggers_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_skills_name_unique` ON `custom_skills` (`name`);