CREATE TABLE `comfyui_workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`workflow_json` text NOT NULL,
	`parameter_mapping` text DEFAULT '{}',
	`is_default` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
