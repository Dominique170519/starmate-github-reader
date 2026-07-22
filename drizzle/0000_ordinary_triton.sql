CREATE TABLE `library_repositories` (
	`library_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`library_id`, `repository_id`)
);
--> statement-breakpoint
CREATE TABLE `repository_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`source_sha` text NOT NULL,
	`package_json` text NOT NULL,
	`synced_at` integer NOT NULL,
	`updated_at` text NOT NULL
);
