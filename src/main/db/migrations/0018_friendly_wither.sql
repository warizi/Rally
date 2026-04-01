CREATE TABLE `recurring_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text,
	`rule_title` text NOT NULL,
	`workspace_id` text NOT NULL,
	`completed_date` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `recurring_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_completions_workspace_date` ON `recurring_completions` (`workspace_id`,`completed_date`);--> statement-breakpoint
CREATE INDEX `idx_recurring_completions_rule` ON `recurring_completions` (`rule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recurring_completion` ON `recurring_completions` (`rule_id`,`completed_date`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`recurrence_type` text NOT NULL,
	`days_of_week` text,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`start_time` text,
	`end_time` text,
	`reminder_offset_ms` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_rules_workspace` ON `recurring_rules` (`workspace_id`);