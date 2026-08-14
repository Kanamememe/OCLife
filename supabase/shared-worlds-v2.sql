-- OC Life shared-world backend schema/security revision 2
-- Run after shared-worlds.sql and shared-worlds-security-fix.sql.
-- This migration is idempotent and can also upgrade an existing V1 installation.

create or replace function public.oclife_shared_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok', true,
    'schema_version', 2,
    'security_revision', 2,
    'max_push_ops', 25,
    'max_members', 50
  );
$$;

grant execute on function public.oclife_shared_health() to anon, authenticated;

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
  if octet_length(coalesce(p_world, '{}'::jsonb)::text) > 500000 then
    raise exception '世界資料過大';
  end if;
  if jsonb_typeof(coalesce(p_ops, '[]'::jsonb)) <> 'array' then
    raise exception '初始共享資料格式無效';
  end if;
  if jsonb_array_length(coalesce(p_ops, '[]'::jsonb)) > 1000 then
    raise exception '初始共享資料超過上限';
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

    if v_type not in ('character','moment','event')
       or v_action not in ('upsert','delete')
       or v_entity_id = '' then
      continue;
    end if;

    if v_action = 'upsert' then
      v_payload := (coalesce(v_payload, '{}'::jsonb) - 'sharedOwnerMemberId' - 'sharedOwnerName')
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
  v_active_members integer;
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
    select count(*) into v_active_members
    from public.oclife_shared_members
    where world_id = v_world_id and active;
    if v_active_members >= 50 then
      raise exception '共享世界成員已達上限';
    end if;
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
  v_member_id_text text;
  v_member_name text;
  v_existing_owner text;
  v_existing_owner_name text;
  v_last_seq bigint;
begin
  v_role := public.oclife_shared_member_role(p_world_id, p_member_id, p_member_token);
  if v_role is null or v_role = 'viewer' then
    raise exception '你沒有編輯這個共享世界的權限' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_ops, '[]'::jsonb)) <> 'array' then
    raise exception '共享操作格式無效';
  end if;
  if jsonb_array_length(coalesce(p_ops, '[]'::jsonb)) > 25 then
    raise exception '單次共享操作超過上限';
  end if;

  select display_name into v_member_name
  from public.oclife_shared_members
  where id = p_member_id and world_id = p_world_id and active;
  v_member_id_text := p_member_id::text;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    v_type := v_op->>'entity_type';
    v_action := coalesce(v_op->>'action', 'upsert');
    v_entity_id := left(coalesce(v_op->>'entity_id', ''), 160);
    v_op_id := coalesce(nullif(v_op->>'op_id', '')::uuid, gen_random_uuid());
    v_payload := v_op->'payload';
    v_existing_owner := null;
    v_existing_owner_name := null;

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
      if jsonb_typeof(v_payload) <> 'object' then
        raise exception '世界資料格式無效';
      end if;
      if octet_length(v_payload::text) > 500000 then
        raise exception '世界資料過大';
      end if;
      update public.oclife_shared_worlds
      set world_payload = v_payload, updated_at = now()
      where id = p_world_id;
    else
      select x.payload->>'sharedOwnerMemberId', x.payload->>'sharedOwnerName'
      into v_existing_owner, v_existing_owner_name
      from public.oclife_shared_ops x
      where x.world_id = p_world_id
        and x.entity_type = v_type
        and x.entity_id = v_entity_id
        and x.action = 'upsert'
      order by x.seq desc
      limit 1;

      if v_existing_owner is not null
         and v_role <> 'owner'
         and v_existing_owner <> v_member_id_text then
        raise exception '你只能修改或刪除自己建立的角色、動態或事件' using errcode = '42501';
      end if;

      if v_action = 'upsert' then
        v_payload := coalesce(v_payload, '{}'::jsonb);
        if jsonb_typeof(v_payload) <> 'object' then
          raise exception '共享資料格式無效';
        end if;
        if v_existing_owner is null then
          v_existing_owner := v_member_id_text;
          v_existing_owner_name := v_member_name;
        end if;
        v_payload := (v_payload - 'sharedOwnerMemberId' - 'sharedOwnerName')
          || jsonb_build_object(
            'sharedOwnerMemberId', v_existing_owner,
            'sharedOwnerName', coalesce(v_existing_owner_name, v_member_name)
          );
        if octet_length(v_payload::text) > 600000 then
          raise exception '單筆共享資料過大';
        end if;
      else
        v_payload := null;
      end if;
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
