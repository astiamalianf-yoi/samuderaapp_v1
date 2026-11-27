CREATE TABLE IF NOT EXISTS `report_followups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL REFERENCES `fisherman_reports`(`id`),
	`fisherman_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`incident_id` text,
	`channel` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `report_followups_report_kind` ON `report_followups` (`report_id`,`kind`);