CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_idx` ON `organizations` (`slug`);
--> statement-breakpoint
INSERT INTO `organizations` (`id`, `name`, `slug`, `plan`, `created_at`, `updated_at`) VALUES ('default-org', 'Personal organization', 'personal', 'free', datetime('now'), datetime('now'));
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_membership_idx` ON `organization_members` (`organization_id`,`user_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text DEFAULT 'default-org' NOT NULL,
	`owner_user_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_workspaces` (`id`, `organization_id`, `owner_user_id`, `name`, `slug`, `created_at`, `updated_at`)
SELECT `id`, 'default-org', NULL, `name`, `slug`, `created_at`, `updated_at` FROM `workspaces`;
--> statement-breakpoint
DROP TABLE `workspaces`;
--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_idx` ON `workspaces` (`slug`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
