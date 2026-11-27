ALTER TABLE `words` ADD `tag` text;--> statement-breakpoint
CREATE INDEX `words_tag_idx` ON `words` (`tag`);