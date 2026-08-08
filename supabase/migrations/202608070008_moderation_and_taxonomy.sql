create type private.review_status as enum ('open', 'under_review', 'resolved', 'rejected');

create table private.taxonomy_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete restrict,
  entity_type text not null check (entity_type in ('city', 'organization', 'category')),
  payload jsonb not null,
  status private.review_status not null default 'open',
  reviewed_by uuid references auth.users (id) on delete restrict,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  reason text not null check (reason in ('fraud', 'spam', 'inaccuracy', 'expired', 'impersonation', 'discrimination', 'privacy', 'prohibited-item')),
  details text not null check (char_length(details) between 30 and 4000),
  urgent boolean not null default false,
  status private.review_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index member_reports_open_duplicate_idx
  on private.member_reports (reporter_id, listing_id, reason)
  where status in ('open', 'under_review');

create table private.illegal_content_notices (
  id uuid primary key default gen_random_uuid(),
  receipt_code uuid not null default gen_random_uuid() unique,
  listing_id uuid references public.listings (id) on delete restrict,
  category text not null check (category in ('illegal-content', 'privacy', 'unsafe-housing', 'prohibited-item', 'other')),
  explanation text not null check (char_length(explanation) between 80 and 5000),
  good_faith_attested boolean not null check (good_faith_attested),
  status private.review_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.moderation_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete restrict,
  actor_id uuid not null references auth.users (id) on delete restrict,
  report_id uuid,
  action text not null check (action in ('hide', 'restore', 'restrict-owner', 'unrestrict-owner')),
  reason text not null check (char_length(reason) between 10 and 1000),
  previous_visible boolean not null,
  resulting_visible boolean not null,
  created_at timestamptz not null default now()
);

create table private.listing_restrictions (
  listing_id uuid primary key references public.listings (id) on delete restrict,
  restricted boolean not null,
  reason text not null,
  moderation_history_id bigint not null references private.moderation_history (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table private.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete restrict,
  template_kind text not null check (template_kind in ('listing-hidden', 'listing-restored', 'role-changed')),
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'retrying', 'accepted', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  provider_email_id text unique,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users (id) on delete restrict,
  target_id uuid not null references auth.users (id) on delete restrict,
  role private.app_role not null,
  action text not null check (action in ('grant', 'revoke')),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['taxonomy_requests','member_reports','illegal_content_notices','moderation_history','listing_restrictions','notification_outbox','role_audit'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('alter table private.%I force row level security', t);
  end loop;
end $$;
revoke all on private.taxonomy_requests, private.member_reports, private.illegal_content_notices,
  private.moderation_history, private.listing_restrictions, private.notification_outbox,
  private.role_audit from public, anon, authenticated;
grant all on private.taxonomy_requests, private.member_reports, private.illegal_content_notices,
  private.moderation_history, private.listing_restrictions, private.notification_outbox,
  private.role_audit to service_role;
grant usage, select on all sequences in schema private to service_role;

create function private.prevent_audit_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin raise exception using errcode = '42501', message = 'audit history is append-only'; end;
$$;
create trigger moderation_history_append_only before update or delete on private.moderation_history
for each row execute function private.prevent_audit_mutation();
create trigger role_audit_append_only before update or delete on private.role_audit
for each row execute function private.prevent_audit_mutation();

create function public.submit_taxonomy_request(p_entity_type text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, private, auth as $$
declare v_id uuid; begin
  if not public.current_user_is_active() or p_entity_type not in ('city','organization','category')
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 4000
  then raise exception using errcode = '23514', message = 'taxonomy request is invalid'; end if;
  insert into private.taxonomy_requests (requester_id, entity_type, payload)
  values (auth.uid(), p_entity_type, p_payload) returning id into v_id;
  return v_id;
end; $$;

create function public.submit_member_report(p_listing_id uuid, p_reason text, p_details text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, private, auth as $$
declare v_id uuid; begin
  if not public.current_user_is_active() or p_reason not in ('fraud','spam','inaccuracy','expired','impersonation','discrimination','privacy','prohibited-item')
    or char_length(p_details) not between 30 and 4000
    or not exists (select 1 from public.listings where id = p_listing_id)
  then raise exception using errcode = '23514', message = 'report is invalid'; end if;
  insert into private.member_reports (reporter_id, listing_id, reason, details, urgent)
  values (auth.uid(), p_listing_id, p_reason, p_details, p_reason in ('fraud','impersonation','privacy'))
  on conflict (reporter_id, listing_id, reason) where status in ('open','under_review')
  do update set updated_at = now() returning id into v_id;
  return v_id;
end; $$;

create function public.submit_illegal_content_notice(
  p_listing_id uuid, p_category text, p_explanation text, p_good_faith_attested boolean
)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_receipt uuid; begin
  if p_category not in ('illegal-content','privacy','unsafe-housing','prohibited-item','other')
    or char_length(p_explanation) not between 80 and 5000 or p_good_faith_attested is not true
    or (p_listing_id is not null and not exists (select 1 from public.listings where id = p_listing_id))
  then raise exception using errcode = '23514', message = 'notice is invalid'; end if;
  insert into private.illegal_content_notices (listing_id, category, explanation, good_faith_attested)
  values (p_listing_id, p_category, p_explanation, true) returning receipt_code into v_receipt;
  return v_receipt;
end; $$;

create function public.admin_actor_has_any_role(p_actor_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = pg_catalog, private as $$
  select exists (select 1 from private.user_roles where user_id = p_actor_id and role::text = any(p_roles));
$$;

create function public.admin_list_moderation_work(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
begin
  if not public.admin_actor_has_any_role(p_actor_id, array['moderator','administrator'])
  then raise exception using errcode = '42501', message = 'moderation queue forbidden'; end if;
  return jsonb_build_object(
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id',id,'listing_id',listing_id,'reason',reason,'details',details,'urgent',urgent,'status',status,'created_at',created_at) order by urgent desc, created_at) from private.member_reports where status in ('open','under_review')), '[]'::jsonb),
    'notices', coalesce((select jsonb_agg(jsonb_build_object('id',id,'receipt_code',receipt_code,'listing_id',listing_id,'category',category,'explanation',explanation,'status',status,'created_at',created_at) order by created_at) from private.illegal_content_notices where status in ('open','under_review')), '[]'::jsonb)
  );
end; $$;

create function public.admin_list_taxonomy_requests(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, private as $$
begin
  if not public.admin_actor_has_any_role(p_actor_id, array['operator','administrator'])
  then raise exception using errcode = '42501', message = 'taxonomy queue forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'entity_type',entity_type,'payload',payload,'status',status,'created_at',created_at) order by created_at) from private.taxonomy_requests where status = 'open'), '[]'::jsonb);
end; $$;

create function public.admin_moderate_listing(
  p_actor_id uuid, p_listing_id uuid, p_action text, p_reason text, p_report_id uuid default null
)
returns bigint language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_listing public.listings%rowtype; v_visible boolean; v_history bigint; begin
  if not public.admin_actor_has_any_role(p_actor_id, array['moderator','administrator'])
    or p_action not in ('hide','restore') or char_length(p_reason) not between 10 and 1000
  then raise exception using errcode = '42501', message = 'moderation action forbidden'; end if;
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then raise exception using errcode = '02000', message = 'listing unavailable'; end if;
  v_visible := p_action = 'restore';
  update public.listings set moderation_visible = v_visible where id = p_listing_id;
  insert into private.moderation_history (listing_id, actor_id, report_id, action, reason, previous_visible, resulting_visible)
  values (p_listing_id, p_actor_id, p_report_id, p_action, p_reason, v_listing.moderation_visible, v_visible)
  returning id into v_history;
  insert into private.listing_restrictions (listing_id, restricted, reason, moderation_history_id)
  values (p_listing_id, not v_visible, p_reason, v_history)
  on conflict (listing_id) do update set restricted = excluded.restricted, reason = excluded.reason,
    moderation_history_id = excluded.moderation_history_id, updated_at = now();
  insert into private.notification_outbox (recipient_id, template_kind, payload, idempotency_key)
  values (v_listing.owner_id, case when v_visible then 'listing-restored' else 'listing-hidden' end,
    jsonb_build_object('listingId', p_listing_id, 'reason', p_reason, 'historyId', v_history),
    'moderation/' || v_history::text);
  insert into private.cache_invalidation_outbox (aggregate_type, aggregate_id, aggregate_version, reason)
  values ('listing', p_listing_id, v_listing.version + 1, 'moderation:' || p_action)
  on conflict do nothing;
  if p_report_id is not null then update private.member_reports set status = 'resolved', updated_at = now() where id = p_report_id; end if;
  return v_history;
end; $$;

create function public.admin_review_taxonomy_request(
  p_actor_id uuid, p_request_id uuid, p_decision text, p_note text
)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_request private.taxonomy_requests%rowtype; begin
  if not public.admin_actor_has_any_role(p_actor_id, array['operator','administrator']) or p_decision not in ('approve','reject')
  then raise exception using errcode = '42501', message = 'taxonomy review forbidden'; end if;
  select * into v_request from private.taxonomy_requests where id = p_request_id and status = 'open' for update;
  if not found then return false; end if;
  if p_decision = 'approve' then
    if v_request.entity_type = 'city' then
      insert into public.cities (slug,name,country_code,timezone) values (v_request.payload->>'slug',v_request.payload->>'name',v_request.payload->>'countryCode',v_request.payload->>'timezone');
    elsif v_request.entity_type = 'organization' then
      insert into public.organizations (city_id,slug,name) values (nullif(v_request.payload->>'cityId','')::uuid,v_request.payload->>'slug',v_request.payload->>'name');
    else
      insert into public.resource_categories (kind,slug,label) values ((v_request.payload->>'kind')::public.listing_kind,v_request.payload->>'slug',v_request.payload->>'label');
    end if;
  end if;
  update private.taxonomy_requests set status = case when p_decision='approve' then 'resolved' else 'rejected' end,
    reviewed_by = p_actor_id, review_note = left(p_note,1000), updated_at = now() where id = p_request_id;
  return true;
end; $$;

create function public.admin_manage_role(
  p_actor_id uuid, p_target_id uuid, p_role private.app_role, p_action text
)
returns boolean language plpgsql security definer set search_path = pg_catalog, private, auth as $$
begin
  if not public.admin_actor_has_any_role(p_actor_id, array['administrator']) or p_actor_id = p_target_id
    or p_action not in ('grant','revoke') then raise exception using errcode = '42501', message = 'role action forbidden'; end if;
  if p_action = 'revoke' and p_role = 'administrator' and
    (select count(*) from private.user_roles where role = 'administrator') <= 1
  then raise exception using errcode = '23514', message = 'last administrator cannot be removed'; end if;
  if p_action = 'grant' then insert into private.user_roles (user_id,role,granted_by) values (p_target_id,p_role,p_actor_id) on conflict do nothing;
  else delete from private.user_roles where user_id = p_target_id and role = p_role; end if;
  insert into private.role_audit (actor_id,target_id,role,action) values (p_actor_id,p_target_id,p_role,p_action);
  insert into private.notification_outbox (recipient_id,template_kind,payload,idempotency_key)
  values (p_target_id,'role-changed',jsonb_build_object('role',p_role,'action',p_action), 'role/' || p_target_id::text || '/' || p_role::text || '/' || extract(epoch from now())::bigint);
  return true;
end; $$;

create function public.admin_lease_notification_outbox(p_limit integer, p_lease_token uuid)
returns table (notification_id uuid, recipient_email text, template_kind text, payload jsonb, idempotency_key text)
language plpgsql security definer set search_path = pg_catalog, private, auth as $$
begin
  return query with candidates as (
    select n.id from private.notification_outbox n
    where ((n.status in ('queued','retrying') and n.available_at <= now()) or (n.status='sending' and n.leased_until <= now()))
      and n.attempts < 5 order by n.available_at,n.created_at for update skip locked
    limit least(greatest(p_limit,1),25)
  ), leased as (
    update private.notification_outbox n set status='sending', lease_token=p_lease_token,
      leased_until=now()+interval '2 minutes', attempts=n.attempts+1, updated_at=now()
    from candidates c where n.id=c.id returning n.*
  ) select l.id,u.email::text,l.template_kind,l.payload,l.idempotency_key
  from leased l join auth.users u on u.id=l.recipient_id;
end; $$;

create function public.admin_mark_notification_accepted(p_id uuid,p_lease_token uuid,p_provider_email_id text)
returns boolean language plpgsql security definer set search_path = pg_catalog,private as $$
begin update private.notification_outbox set status='accepted',provider_email_id=p_provider_email_id,
  lease_token=null,leased_until=null,error_code=null,updated_at=now()
  where id=p_id and lease_token=p_lease_token and status='sending'; return found; end; $$;

create function public.admin_retry_notification(p_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean)
returns boolean language plpgsql security definer set search_path = pg_catalog,private as $$
begin update private.notification_outbox set status=case when p_retryable and attempts<5 then 'retrying' else 'failed' end,
  available_at=case when p_retryable then now()+make_interval(secs=>least(900,30*attempts*attempts)) else available_at end,
  lease_token=null,leased_until=null,error_code=left(p_error_code,80),updated_at=now()
  where id=p_id and lease_token=p_lease_token and status='sending'; return found; end; $$;

create function public.admin_apply_notification_event(p_provider_email_id text,p_event_type text)
returns boolean language plpgsql security definer set search_path = pg_catalog,private as $$
begin update private.notification_outbox set status=case
    when p_event_type='email.delivered' then 'delivered'
    when p_event_type in ('email.bounced','email.complained','email.suppressed','email.failed') then 'failed'
    else status end, updated_at=now()
  where provider_email_id=p_provider_email_id and status in ('accepted','delivered'); return found; end; $$;

revoke execute on function public.submit_taxonomy_request(text,jsonb) from public, anon;
revoke execute on function public.submit_member_report(uuid,text,text) from public, anon;
revoke execute on function public.submit_illegal_content_notice(uuid,text,text,boolean) from public;
grant execute on function public.submit_taxonomy_request(text,jsonb) to authenticated;
grant execute on function public.submit_member_report(uuid,text,text) to authenticated;
grant execute on function public.submit_illegal_content_notice(uuid,text,text,boolean) to anon, authenticated;

revoke execute on function public.admin_actor_has_any_role(uuid,text[]) from public, anon, authenticated;
revoke execute on function public.admin_list_moderation_work(uuid) from public, anon, authenticated;
revoke execute on function public.admin_list_taxonomy_requests(uuid) from public, anon, authenticated;
revoke execute on function public.admin_moderate_listing(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.admin_review_taxonomy_request(uuid,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.admin_manage_role(uuid,uuid,private.app_role,text) from public, anon, authenticated;
revoke execute on function public.admin_lease_notification_outbox(integer,uuid) from public,anon,authenticated;
revoke execute on function public.admin_mark_notification_accepted(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.admin_retry_notification(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke execute on function public.admin_apply_notification_event(text,text) from public,anon,authenticated;
grant execute on function public.admin_actor_has_any_role(uuid,text[]) to service_role;
grant execute on function public.admin_list_moderation_work(uuid) to service_role;
grant execute on function public.admin_list_taxonomy_requests(uuid) to service_role;
grant execute on function public.admin_moderate_listing(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.admin_review_taxonomy_request(uuid,uuid,text,text) to service_role;
grant execute on function public.admin_manage_role(uuid,uuid,private.app_role,text) to service_role;
grant execute on function public.admin_lease_notification_outbox(integer,uuid) to service_role;
grant execute on function public.admin_mark_notification_accepted(uuid,uuid,text) to service_role;
grant execute on function public.admin_retry_notification(uuid,uuid,text,boolean) to service_role;
grant execute on function public.admin_apply_notification_event(text,text) to service_role;
