CREATE TABLE `fisherman_class_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fisherman_id` text NOT NULL,
	`reason` text NOT NULL,
	`effective_profile` text NOT NULL,
	`activity` text,
	`mean_probability` real,
	`behavioural_class` integer,
	`per_sign` text,
	`source` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`fisherman_id`) REFERENCES `fishermen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fisherman_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fisherman_id` text NOT NULL,
	`beach` text NOT NULL,
	`signs` text NOT NULL,
	`channel` text NOT NULL,
	`counted` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`fisherman_id`) REFERENCES `fishermen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`fisherman_id` text NOT NULL,
	`beach` text NOT NULL,
	`type` text NOT NULL,
	`need_help` integer DEFAULT false NOT NULL,
	`latitude` real,
	`longitude` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`fisherman_id`) REFERENCES `fishermen`(`id`) ON UPDATE no action ON DELETE no action
);
