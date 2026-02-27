-- 중복 workspace_id 행 제거 (최신 id 하나만 보존)
DELETE FROM `tab_sessions`
WHERE `id` NOT IN (
  SELECT MAX(`id`) FROM `tab_sessions` GROUP BY `workspace_id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tab_sessions_workspace_id_unique` ON `tab_sessions` (`workspace_id`);
