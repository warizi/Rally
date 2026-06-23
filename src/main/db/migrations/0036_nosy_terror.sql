ALTER TABLE `canvas_groups` ADD `parent_id` text REFERENCES canvas_groups(id);--> statement-breakpoint
CREATE INDEX `idx_canvas_groups_parent` ON `canvas_groups` (`parent_id`);