CREATE TABLE `system_skill_overrides` (
	`name` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`mcp_tools_json` text DEFAULT '[]' NOT NULL,
	`triggers_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
