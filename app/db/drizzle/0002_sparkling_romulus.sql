ALTER TABLE `research_images` ADD `source_id` varchar(128);--> statement-breakpoint
ALTER TABLE `researches` ADD `thumbnail` text;--> statement-breakpoint
ALTER TABLE `research_images` ADD CONSTRAINT `research_images_source_id_research_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `research_sources`(`id`) ON DELETE set null ON UPDATE no action;