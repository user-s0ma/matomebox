CREATE TABLE `research_images` (
	`id` varchar(128) NOT NULL,
	`research_id` varchar(128) NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`analysis` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `research_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_progress` (
	`id` varchar(128) NOT NULL,
	`research_id` varchar(128) NOT NULL,
	`status_message` text NOT NULL,
	`progress_percentage` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `research_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_sources` (
	`id` varchar(128) NOT NULL,
	`research_id` varchar(128) NOT NULL,
	`url` text NOT NULL,
	`domain` varchar(255) NOT NULL,
	`title` text,
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `research_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `researches` (
	`id` varchar(128) NOT NULL,
	`query` varchar(255) NOT NULL,
	`title` varchar(255),
	`category` varchar(255),
	`depth` int NOT NULL,
	`breadth` int NOT NULL,
	`status` int NOT NULL,
	`content` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `researches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `research_images` ADD CONSTRAINT `research_images_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_progress` ADD CONSTRAINT `research_progress_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_sources` ADD CONSTRAINT `research_sources_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE no action ON UPDATE no action;