CREATE TABLE IF NOT EXISTS `warning_level_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beach` text NOT NULL,
	`level` text NOT NULL,
	`prev_level` text,
	`cause` text NOT NULL,
	`lik_level` text,
	`lik_codes` text,
	`lik_reporters` integer,
	`lik_ends_at` integer,
	`bmkg_level` text NOT NULL,
	`forecast_level` text,
	`official` text,
	`wind_kmh` real,
	`simulated` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `warning_level_history_beach` ON `warning_level_history` (`beach`,`id`);
