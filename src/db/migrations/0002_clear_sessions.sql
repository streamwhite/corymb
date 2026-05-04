-- Invalidate sessions before switching token_hash from SHA-256 hex to Argon2 PHC strings.
DELETE FROM `sessions`;
