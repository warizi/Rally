CREATE TABLE `system_skills` (
	`name` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`mcp_tools_json` text DEFAULT '[]' NOT NULL,
	`triggers_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `system_skills` (`name`, `content`, `mcp_tools_json`, `triggers_json`, `created_at`, `updated_at`)
SELECT `name`, `content`, `mcp_tools_json`, `triggers_json`, `updated_at`, `updated_at`
FROM `system_skill_overrides`;
--> statement-breakpoint
DROP TABLE `system_skill_overrides`;
