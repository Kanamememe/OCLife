-- OC Life shared-world backend v1
-- Run this whole file once in Supabase SQL Editor.
-- It uses append-only operations so several devices can edit without overwriting the whole world.

create extension if not exists pgcrypto;

create table if not exists public.oclife_shared_worlds (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  world_payload jsonb not null default '{}'::jsonb,
  owner_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.oclife_shared_members (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.oclife_shared_worlds(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  token_hash text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.oclife_shared_worlds
  drop constraint if exists oclife_shared_worlds_owner_member_id_fkey;

alter table public.oclife_shared_worlds
  add constraint oclife_shared_worlds_owner_member_id_fkey
  foreign key (owner_member_id)
  references public.oclife_shared_members(id)
  on delete set null;

create unique index if not exists oclife_shared_members_token_idx
  on public.oclife_shared_members(world_id, token_hash)
  where active;

create index if not exists oclife_shared_members_world_idx
  on public.oclife_shared_members(world_id, active, last_seen_at desc);

create table if not exists public.oclife_shared_ops (
  seq bigint generated always as identity primary key,
  op_id uuid not null unique,
  world_id uuid not null references public.oclife_shared_worlds(id) on delete cascade,
  member_id uuid not null references public.oclife_shared_members(id) on delete cascade,
  entity_type text not null check (entity_type in ('world','character','moment','event')),
  entity_id text not null,
  action text not null check (action in ('upsert','delete')),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists oclife_shared_ops_world_seq_idx
  on public.oclife_shared_ops(world_id, seq);

alter table public.oclife_shared_worlds enable row level security;
alter table public.oclife_shared_members enable row level security;
alter table public.oclife_shared_ops enable row level security;

-- No direct table policy is intentionally created. Browser clients can only use
-- the token-checking security-definer RPC functions below.
revoke all on public.oclife_shared_worlds from anon, authenticated;
revoke all on public.oclife_shared_members from anon, authenticated;
revoke all on public.oclife_shared_ops from anon, authenticated;

create or replace function public.oclife_shared_token_hash(p_token text)
returns text
language sql
immutable
strict
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function public.oclife_shared_token_hash(text) from public, anon, authenticated;

create or replace function public.oclife_shared_new_invite()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  loop
    v_code := 'OCL-' || substr(replace(upper(gen_random_uuid()::text), '-', ''), 1, 4)
                    || '-' || substr(replace(upper(gen_random_uuid()::text), '-', ''), 1, 4);
    exit when not exists (
      select 1 from public.oclife_shared_worlds where invite_code = v_code and deleted_at is null
    );
  end loop;
  return v_code;
end;
$$;

revoke all on function public.oclife_shared_new_invite() from public, anon, authenticated;

create or replace function public.oclife_shared_member_role(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.oclife_shared_members m
  join public.oclife_shared_worlds w on w.id = m.world_id
  where m.world_id = p_world_id
    and m.id = p_member_id
    and m.active
    and w.deleted_at is null
    and m.token_hash = public.oclife_shared_token_hash(p_member_token)
  limit 1;
$$;

revoke all on function public.oclife_shared_member_role(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.oclife_shared_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('ok', true, 'schema_version', 1);
$$;

grant execute on function public.oclife_shared_health() to anon, authenticated;

create or replace function public.oclife_shared_pull(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text,
  p_after_seq bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_world public.oclife_shared_worlds%rowtype;
  v_last_seq bigint;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role is null then
    raise exception '共享世界憑證無效或成員已被移除' using errcode = '42501';
  end if;

  select * into v_world
  from public.oclife_shared_worlds
  where id = p_world_id and deleted_at is null;

  if not found then
    raise exception '共享世界不存在或已刪除' using errcode = 'P0002';
  end if;

  update public.oclife_shared_members
  set last_seen_at = now()
  where id = p_member_id;

  select coalesce(max(seq), 0) into v_last_seq
  from public.oclife_shared_ops
  where world_id = p_world_id;

  return jsonb_build_object(
    'world_id', v_world.id,
    'invite_code', v_world.invite_code,
    'world', v_world.world_payload,
    'member_id', p_member_id,
    'role', v_role,
    'last_seq', v_last_seq,
    'ops', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'seq', o.seq,
          'op_id', o.op_id,
          'member_id', o.member_id,
          'entity_type', o.entity_type,
          'entity_id', o.entity_id,
          'action', o.action,
          'payload', o.payload,
          'created_at', o.created_at
        ) order by o.seq
      )
      from public.oclife_shared_ops o
      where o.world_id = p_world_id
        and o.seq > greatest(coalesce(p_after_seq, 0), 0)
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'display_name', m.display_name,
          'role', m.role,
          'joined_at', m.joined_at,
          'last_seen_at', m.last_seen_at,
          'active', m.active
        ) order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, m.joined_at
      )
      from public.oclife_shared_members m
      where m.world_id = p_world_id and m.active
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.oclife_shared_pull(uuid, uuid, text, bigint) to anon, authenticated;

create or replace function public.oclife_shared_create_world(
  p_member_name text,
  p_member_token text,
  p_world jsonb,
  p_ops jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_world_id uuid;
  v_member_id uuid;
  v_invite text;
  v_op jsonb;
  v_type text;
  v_action text;
  v_payload jsonb;
  v_entity_id text;
  v_op_id uuid;
begin
  p_member_name := left(trim(coalesce(p_member_name, '')), 40);
  if char_length(p_member_name) < 1 then
    raise exception '請輸入共享世界中的顯示名稱';
  end if;
  if char_length(coalesce(p_member_token, '')) < 24 then
    raise exception '成員憑證長度不足';
  end if;
  if jsonb_typeof(coalesce(p_world, '{}'::jsonb)) <> 'object' then
    raise exception '世界資料格式無效';
  end if;

  v_invite := public.oclife_shared_new_invite();
  insert into public.oclife_shared_worlds(invite_code, world_payload)
  values (v_invite, coalesce(p_world, '{}'::jsonb))
  returning id into v_world_id;

  insert into public.oclife_shared_members(world_id, display_name, role, token_hash)
  values (v_world_id, p_member_name, 'owner', public.oclife_shared_token_hash(p_member_token))
  returning id into v_member_id;

  update public.oclife_shared_worlds
  set owner_member_id = v_member_id
  where id = v_world_id;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    v_type := v_op->>'entity_type';
    v_action := coalesce(v_op->>'action', 'upsert');
    v_entity_id := left(coalesce(v_op->>'entity_id', ''), 160);
    v_op_id := coalesce(nullif(v_op->>'op_id', '')::uuid, gen_random_uuid());
    v_payload := v_op->'payload';

    if v_type not in ('character','moment','event') or v_action not in ('upsert','delete') or v_entity_id = '' then
      continue;
    end if;

    if v_action = 'upsert' then
      v_payload := coalesce(v_payload, '{}'::jsonb)
        || jsonb_build_object(
          'sharedOwnerMemberId', v_member_id::text,
          'sharedOwnerName', p_member_name
        );
      if octet_length(v_payload::text) > 600000 then
        raise exception '單筆共享資料過大';
      end if;
    else
      v_payload := null;
    end if;

    insert into public.oclife_shared_ops(
      op_id, world_id, member_id, entity_type, entity_id, action, payload
    ) values (
      v_op_id, v_world_id, v_member_id, v_type, v_entity_id, v_action, v_payload
    ) on conflict (op_id) do nothing;
  end loop;

  return public.oclife_shared_pull(v_world_id, v_member_id, p_member_token, 0);
end;
$$;

grant execute on function public.oclife_shared_create_world(text, text, jsonb, jsonb) to anon, authenticated;

create or replace function public.oclife_shared_join_world(
  p_invite_code text,
  p_member_name text,
  p_member_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_world_id uuid;
  v_member_id uuid;
  v_hash text;
begin
  p_invite_code := upper(trim(coalesce(p_invite_code, '')));
  p_member_name := left(trim(coalesce(p_member_name, '')), 40);
  if p_member_name = '' then
    raise exception '請輸入共享世界中的顯示名稱';
  end if;
  if char_length(coalesce(p_member_token, '')) < 24 then
    raise exception '成員憑證長度不足';
  end if;

  select id into v_world_id
  from public.oclife_shared_worlds
  where invite_code = p_invite_code and deleted_at is null;

  if v_world_id is null then
    raise exception '邀請碼不存在或已失效' using errcode = 'P0002';
  end if;

  v_hash := public.oclife_shared_token_hash(p_member_token);
  select id into v_member_id
  from public.oclife_shared_members
  where world_id = v_world_id and token_hash = v_hash and active
  limit 1;

  if v_member_id is null then
    insert into public.oclife_shared_members(world_id, display_name, role, token_hash)
    values (v_world_id, p_member_name, 'editor', v_hash)
    returning id into v_member_id;
  else
    update public.oclife_shared_members
    set display_name = p_member_name, last_seen_at = now()
    where id = v_member_id;
  end if;

  return public.oclife_shared_pull(v_world_id, v_member_id, p_member_token, 0);
end;
$$;

grant execute on function public.oclife_shared_join_world(text, text, text) to anon, authenticated;

create or replace function public.oclife_shared_push(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text,
  p_ops jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_op jsonb;
  v_type text;
  v_action text;
  v_entity_id text;
  v_payload jsonb;
  v_op_id uuid;
  v_inserted integer := 0;
  v_owner_id text;
  v_owner_name text;
  v_last_seq bigint;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role is null or v_role = 'viewer' then
    raise exception '你沒有編輯這個共享世界的權限' using errcode = '42501';
  end if;

  select display_name into v_owner_name
  from public.oclife_shared_members
  where id = p_member_id;
  v_owner_id := p_member_id::text;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    v_type := v_op->>'entity_type';
    v_action := coalesce(v_op->>'action', 'upsert');
    v_entity_id := left(coalesce(v_op->>'entity_id', ''), 160);
    v_op_id := coalesce(nullif(v_op->>'op_id', '')::uuid, gen_random_uuid());
    v_payload := v_op->'payload';

    if v_type not in ('world','character','moment','event')
       or v_action not in ('upsert','delete')
       or v_entity_id = '' then
      continue;
    end if;

    if v_type = 'world' then
      if v_role <> 'owner' then
        raise exception '只有建立者能修改共享世界資料' using errcode = '42501';
      end if;
      if v_action = 'delete' then
        raise exception '請使用刪除共享世界功能';
      end if;
      v_payload := coalesce(v_payload, '{}'::jsonb);
      update public.oclife_shared_worlds
      set world_payload = v_payload, updated_at = now()
      where id = p_world_id;
    elsif v_action = 'upsert' then
      v_payload := coalesce(v_payload, '{}'::jsonb);
      if coalesce(v_payload->>'sharedOwnerMemberId', '') = '' then
        v_payload := v_payload || jsonb_build_object(
          'sharedOwnerMemberId', v_owner_id,
          'sharedOwnerName', v_owner_name
        );
      end if;
      if v_role <> 'owner'
         and coalesce(v_payload->>'sharedOwnerMemberId', '') <> v_owner_id then
        raise exception '你只能修改自己建立的角色、動態或事件' using errcode = '42501';
      end if;
      if octet_length(v_payload::text) > 600000 then
        raise exception '單筆共享資料過大';
      end if;
    else
      -- Delete permission is checked against the most recent upsert owner.
      if v_role <> 'owner' and exists (
        select 1
        from public.oclife_shared_ops x
        where x.world_id = p_world_id
          and x.entity_type = v_type
          and x.entity_id = v_entity_id
          and x.action = 'upsert'
          and coalesce(x.payload->>'sharedOwnerMemberId', '') <> v_owner_id
        order by x.seq desc
        limit 1
      ) then
        raise exception '你只能刪除自己建立的角色、動態或事件' using errcode = '42501';
      end if;
      v_payload := null;
    end if;

    insert into public.oclife_shared_ops(
      op_id, world_id, member_id, entity_type, entity_id, action, payload
    ) values (
      v_op_id, p_world_id, p_member_id, v_type, v_entity_id, v_action, v_payload
    ) on conflict (op_id) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  update public.oclife_shared_worlds set updated_at = now() where id = p_world_id;
  update public.oclife_shared_members set last_seen_at = now() where id = p_member_id;

  select coalesce(max(seq), 0) into v_last_seq
  from public.oclife_shared_ops where world_id = p_world_id;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'last_seq', v_last_seq);
end;
$$;

grant execute on function public.oclife_shared_push(uuid, uuid, text, jsonb) to anon, authenticated;

create or replace function public.oclife_shared_rotate_invite(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_code text;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role <> 'owner' then
    raise exception '只有建立者能重設邀請碼' using errcode = '42501';
  end if;
  v_code := public.oclife_shared_new_invite();
  update public.oclife_shared_worlds
  set invite_code = v_code, updated_at = now()
  where id = p_world_id;
  return jsonb_build_object('ok', true, 'invite_code', v_code);
end;
$$;

grant execute on function public.oclife_shared_rotate_invite(uuid, uuid, text) to anon, authenticated;

create or replace function public.oclife_shared_leave_world(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role is null then
    raise exception '成員憑證無效' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception '建立者不能直接退出；請先複製成私人世界或刪除共享世界';
  end if;
  update public.oclife_shared_members
  set active = false, last_seen_at = now()
  where id = p_member_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.oclife_shared_leave_world(uuid, uuid, text) to anon, authenticated;

create or replace function public.oclife_shared_delete_world(
  p_world_id uuid,
  p_member_id uuid,
  p_member_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role <> 'owner' then
    raise exception '只有建立者能刪除共享世界' using errcode = '42501';
  end if;
  delete from public.oclife_shared_worlds where id = p_world_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.oclife_shared_delete_world(uuid, uuid, text) to anon, authenticated;
