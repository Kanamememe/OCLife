-- OC Life shared-world token hash compatibility fix
-- Run after shared-worlds.sql, shared-worlds-security-fix.sql, and shared-worlds-v2.sql.
-- Supabase installs most extensions outside the public search path. Use PostgreSQL's
-- built-in SHA-256 functions so token hashing does not depend on pgcrypto's schema.

create or replace function public.oclife_shared_token_hash(p_token text)
returns text
language sql
immutable
strict
set search_path = pg_catalog, pg_temp
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'::name)),
    'hex'::text
  );
$$;

revoke all on function public.oclife_shared_token_hash(text) from public, anon, authenticated;

-- Fail immediately during installation instead of waiting for the first user action.
do $$
begin
  if public.oclife_shared_token_hash('abc') <>
     'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' then
    raise exception 'OC Life shared token hash self-test failed';
  end if;
end;
$$;
