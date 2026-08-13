-- Applied after shared-worlds.sql. This replaces the push RPC with stricter
-- server-side ownership checks so a browser cannot claim somebody else's entity.

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
        if v_existing_owner is null then
          v_existing_owner := v_member_id_text;
          v_existing_owner_name := v_member_name;
        end if;
        -- Ownership is authoritative on the server and cannot be reassigned by payload.
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
