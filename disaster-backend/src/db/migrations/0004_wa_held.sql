CREATE TABLE `wa_held` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_hash` text NOT NULL,
	`kind` text NOT NULL,
	`beach` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
