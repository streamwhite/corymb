-- Fuzzy / similarity search support. pg_trgm powers typo-tolerant matching
-- (trigram similarity) and trigram GIN indexes behind PostgREST search RPCs.
-- It is a trusted extension (PostgreSQL 13+), so the migration role only needs
-- CREATE on the database — the same privilege already used for the app schema.
create extension if not exists pg_trgm;
