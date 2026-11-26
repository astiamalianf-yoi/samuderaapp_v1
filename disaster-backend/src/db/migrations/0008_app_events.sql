CREATE TABLE IF NOT EXISTS `app_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fisherman_id` text NOT NULL,
	`event` text NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	`beach` text,
	`channel` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `app_events_once_per_day` ON `app_events` (`fisherman_id`,`event`,`day`,`ref`);
