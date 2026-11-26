CREATE TABLE IF NOT EXISTS `trust_index_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`high` text NOT NULL,
	`low` text NOT NULL,
	`signs` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
