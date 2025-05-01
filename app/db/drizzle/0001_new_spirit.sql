ALTER TABLE `research_images` DROP FOREIGN KEY `research_images_research_id_researches_id_fk`;
--> statement-breakpoint
ALTER TABLE `research_progress` DROP FOREIGN KEY `research_progress_research_id_researches_id_fk`;
--> statement-breakpoint
ALTER TABLE `research_sources` DROP FOREIGN KEY `research_sources_research_id_researches_id_fk`;
--> statement-breakpoint
ALTER TABLE `research_images` ADD CONSTRAINT `research_images_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_progress` ADD CONSTRAINT `research_progress_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_sources` ADD CONSTRAINT `research_sources_research_id_researches_id_fk` FOREIGN KEY (`research_id`) REFERENCES `researches`(`id`) ON DELETE cascade ON UPDATE no action;