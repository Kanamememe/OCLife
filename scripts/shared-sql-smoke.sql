\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema extensions;
create extension pgcrypto with schema extensions;

\ir ../supabase/shared-worlds.sql
\ir ../supabase/shared-worlds-security-fix.sql
\ir ../supabase/shared-worlds-v2.sql
\ir ../supabase/shared-worlds-token-hash-fix.sql

set search_path = public, pg_temp;

do $$
declare
  v_hash text;
  v_created jsonb;
begin
  v_hash := public.oclife_shared_token_hash('abc');
  if v_hash <> 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' then
    raise exception 'token hash mismatch: %', v_hash;
  end if;

  v_created := public.oclife_shared_create_world(
    'SQL Smoke',
    repeat('x', 32),
    '{"name":"SQL Smoke","emoji":"◈"}'::jsonb,
    '[]'::jsonb
  );

  if coalesce(v_created->>'role', '') <> 'owner'
     or coalesce(v_created->>'world_id', '') = ''
     or coalesce(v_created->>'invite_code', '') = '' then
    raise exception 'shared world creation smoke test failed: %', v_created;
  end if;
end;
$$;

select 'Shared SQL smoke test passed.' as result;
