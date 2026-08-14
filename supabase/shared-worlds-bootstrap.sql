-- OC Life shared-world installer bootstrap
-- Supabase installs most extensions in the extensions schema. The original V1
-- function body is parsed while it is created, so expose that schema during the
-- complete installer before shared-worlds.sql is evaluated.

set search_path = pg_catalog, extensions, public, pg_temp;
