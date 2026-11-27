DROP INDEX IF EXISTS `report_followups_report_kind`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `report_followups_report_fisherman_kind` ON `report_followups` (`report_id`,`fisherman_id`,`kind`);