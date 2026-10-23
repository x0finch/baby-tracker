-- Bottles, solids and pumping became duration records (#170): no end now means a running
-- timer. Their earlier records had no end because the duration wasn't recorded; the end is
-- now the start. One sequence bump, so devices pull the changed rows.
UPDATE `sync_seq` SET `value` = `value` + 1 WHERE `id` = 1;--> statement-breakpoint
UPDATE `events`
SET `end_at` = `start_at`,
  `updated_at` = CAST(unixepoch('subsec') * 1000 AS integer),
  `seq` = (SELECT `value` FROM `sync_seq` WHERE `id` = 1)
WHERE `end_at` IS NULL AND (
  `type` = 'pumping' OR (`type` = 'feeding' AND json_extract(`data`, '$.kind') IN ('bottle', 'solids'))
);
