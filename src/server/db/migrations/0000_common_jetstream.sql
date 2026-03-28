CREATE TABLE `character_scene_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_scene_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	`placeholders` text DEFAULT '{}',
	FOREIGN KEY (`project_scene_id`) REFERENCES `project_scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `char_scene_override_unique_idx` ON `character_scene_overrides` (`project_scene_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `char_scene_overrides_scene_idx` ON `character_scene_overrides` (`project_scene_id`);--> statement-breakpoint
CREATE INDEX `char_scene_overrides_char_idx` ON `character_scene_overrides` (`character_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`slot_index` integer DEFAULT 0,
	`name` text NOT NULL,
	`char_prompt` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_project_slot_idx` ON `characters` (`project_id`,`slot_index`);--> statement-breakpoint
CREATE INDEX `characters_project_id_idx` ON `characters` (`project_id`);--> statement-breakpoint
CREATE TABLE `generated_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`project_scene_id` integer NOT NULL,
	`source_scene_id` integer,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`seed` integer,
	`metadata` text DEFAULT '{}',
	`is_favorite` integer DEFAULT 0,
	`rating` integer,
	`memo` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`job_id`) REFERENCES `generation_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_scene_id`) REFERENCES `project_scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generated_images_project_id_idx` ON `generated_images` (`project_id`);--> statement-breakpoint
CREATE INDEX `generated_images_scene_id_idx` ON `generated_images` (`project_scene_id`);--> statement-breakpoint
CREATE INDEX `generated_images_source_scene_idx` ON `generated_images` (`source_scene_id`);--> statement-breakpoint
CREATE INDEX `generated_images_favorite_idx` ON `generated_images` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `generated_images_job_id_idx` ON `generated_images` (`job_id`);--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`project_scene_id` integer NOT NULL,
	`source_scene_id` integer,
	`resolved_prompts` text NOT NULL,
	`resolved_parameters` text NOT NULL,
	`total_count` integer DEFAULT 1,
	`completed_count` integer DEFAULT 0,
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_scene_id`) REFERENCES `project_scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_jobs_status_idx` ON `generation_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `generation_jobs_project_id_idx` ON `generation_jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `generation_jobs_scene_id_idx` ON `generation_jobs` (`project_scene_id`);--> statement-breakpoint
CREATE TABLE `image_tags` (
	`image_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`image_id`, `tag_id`),
	FOREIGN KEY (`image_id`) REFERENCES `generated_images`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `image_tags_tag_id_idx` ON `image_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `project_scene_packs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`scene_pack_id` integer,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_pack_id`) REFERENCES `scene_packs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_scene_packs_project_id_idx` ON `project_scene_packs` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_scene_pack_id` integer NOT NULL,
	`source_scene_id` integer,
	`name` text NOT NULL,
	`placeholders` text DEFAULT '{}',
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_scene_pack_id`) REFERENCES `project_scene_packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_scenes_pack_name_idx` ON `project_scenes` (`project_scene_pack_id`,`name`);--> statement-breakpoint
CREATE INDEX `project_scenes_pack_id_idx` ON `project_scenes` (`project_scene_pack_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`general_prompt` text DEFAULT '',
	`negative_prompt` text DEFAULT '',
	`parameters` text DEFAULT '{}',
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `scene_packs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_pack_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`placeholders` text DEFAULT '{}',
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`scene_pack_id`) REFERENCES `scene_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_pack_name_idx` ON `scenes` (`scene_pack_id`,`name`);--> statement-breakpoint
CREATE INDEX `scenes_scene_pack_id_idx` ON `scenes` (`scene_pack_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);