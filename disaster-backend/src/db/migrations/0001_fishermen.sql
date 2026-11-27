CREATE TABLE `fishermen` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`phone_last4` text NOT NULL,
	`home_beach` text NOT NULL,
	`profile` text,
	`token_hash` text NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fishermen_phone_hash_unique` ON `fishermen` (`phone_hash`);