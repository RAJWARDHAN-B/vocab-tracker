CREATE TABLE `api_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`word_id` text NOT NULL,
	`outcome` text NOT NULL,
	`reviewed_at` text NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reviews_outcome_check" CHECK("reviews"."outcome" IN ('again', 'got_it'))
);
--> statement-breakpoint
CREATE INDEX `reviews_word_id_idx` ON `reviews` (`word_id`);--> statement-breakpoint
CREATE INDEX `reviews_reviewed_at_idx` ON `reviews` (`reviewed_at`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`local_day` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_sessions_local_day_unique` ON `study_sessions` (`local_day`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`normalized_word` text NOT NULL,
	`meaning` text NOT NULL,
	`synonyms` text NOT NULL,
	`antonyms` text NOT NULL,
	`example` text NOT NULL,
	`in_a_sentence` text NOT NULL,
	`image_url` text,
	`image_caption` text,
	`next_review_at` text NOT NULL,
	`review_interval_days` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `words_normalized_word_unique` ON `words` (`normalized_word`);--> statement-breakpoint
CREATE INDEX `words_next_review_at_idx` ON `words` (`next_review_at`);