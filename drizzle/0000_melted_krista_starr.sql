CREATE TABLE `researches` (
	`id` varchar(128) NOT NULL,
	`query` varchar(255) NOT NULL,
	`depth` varchar(255) NOT NULL,
	`breadth` varchar(255) NOT NULL,
	`questions` text NOT NULL,
	`images` text,
	`status` int NOT NULL,
	`result` text,
	`interim_results` text,
	`user` varchar(255) NOT NULL DEFAULT 'unknown',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `researches_id` PRIMARY KEY(`id`)
);
