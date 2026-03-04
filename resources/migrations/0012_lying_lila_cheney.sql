CREATE TABLE `schedule_todos` (
	`schedule_id` text NOT NULL,
	`todo_id` text NOT NULL,
	PRIMARY KEY(`schedule_id`, `todo_id`),
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`all_day` integer DEFAULT false NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`color` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
