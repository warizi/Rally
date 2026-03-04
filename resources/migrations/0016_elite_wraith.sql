CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`offset_ms` integer NOT NULL,
	`remind_at` integer NOT NULL,
	`is_fired` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_entity` ON `reminders` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_reminders_pending` ON `reminders` (`is_fired`,`remind_at`);