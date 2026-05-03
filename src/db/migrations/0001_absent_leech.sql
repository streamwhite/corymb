-- Existing rows cannot satisfy NOT NULL without a default; add nullable column, backfill, then index.
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
UPDATE `users`
SET `username` = 'legacy_' || cast(rowid as text)
WHERE `username` IS NULL
   OR trim(`username`) = '';--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
