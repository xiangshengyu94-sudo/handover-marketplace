create type private.contact_delivery_status as enum (
  'queued', 'sending', 'retrying', 'delayed', 'accepted', 'delivered', 'bounced', 'suppressed', 'failed'
);

create table private.contact_intents (
  id uuid primary key,
  sender_id uuid not null references auth.users (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  request_key uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  message_body text not null check (char_length(message_body) between 20 and 2000),
  consented_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, request_key),
  check (expires_at > created_at)
);

create table private.contact_outbox (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references private.contact_intents (id) on delete restrict,
  sender_id uuid not null references auth.users (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  message_body text not null check (char_length(message_body) between 20 and 2000),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  status private.contact_delivery_status not null default 'queued',
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 256),
  provider_email_id text unique,
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  leased_until timestamptz,
  error_code text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  terminal_at timestamptz,
  body_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'sending') = (lease_token is not null and leased_until is not null))
);

create table private.contact_provider_events (
  event_id text primary key,
  provider_email_id text not null,
  event_type text not null check (event_type in (
    'email.sent', 'email.delivered', 'email.delivery_delayed',
    'email.bounced', 'email.complained', 'email.suppressed', 'email.failed'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  applied_at timestamptz
);

create index contact_outbox_dispatch_idx on private.contact_outbox (status, available_at, created_at);
create index contact_outbox_sender_idx on private.contact_outbox (sender_id, created_at desc);
create index contact_provider_events_email_idx on private.contact_provider_events (provider_email_id, occurred_at);

alter table private.contact_intents enable row level security;
alter table private.contact_intents force row level security;
alter table private.contact_outbox enable row level security;
alter table private.contact_outbox force row level security;
alter table private.contact_provider_events enable row level security;
alter table private.contact_provider_events force row level security;

create function public.issue_contact_intent(
  p_id uuid,
  p_request_key uuid,
  p_listing_id uuid,
  p_token_hash text,
  p_payload_hash text,
  p_message_body text,
  p_expires_at timestamptz
)
returns table (intent_id uuid, intent_expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sender uuid := auth.uid();
  v_intent private.contact_intents%rowtype;
begin
  if v_sender is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '11 minutes'
    or char_length(p_message_body) not between 20 and 2000
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_payload_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception using errcode = '23514', message = 'contact intent is invalid';
  end if;
  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and l.owner_id <> v_sender
      and public.listing_is_contactable(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
  ) then
    raise exception using errcode = '42501', message = 'listing unavailable';
  end if;

  insert into private.contact_intents (
    id, sender_id, listing_id, request_key, token_hash, payload_hash,
    message_body, consented_at, expires_at
  ) values (
    p_id, v_sender, p_listing_id, p_request_key, p_token_hash, p_payload_hash,
    p_message_body, now(), p_expires_at
  ) on conflict (sender_id, request_key) do nothing;

  select * into v_intent from private.contact_intents
  where sender_id = v_sender and request_key = p_request_key;
  if not found
    or v_intent.listing_id <> p_listing_id
    or v_intent.token_hash <> p_token_hash
    or v_intent.payload_hash <> p_payload_hash
    or v_intent.message_body <> p_message_body
    or v_intent.expires_at <= now()
  then
    raise exception using errcode = '23514', message = 'contact request key conflict';
  end if;
  return query select v_intent.id, v_intent.expires_at;
end;
$$;

create function public.consume_contact_intent(
  p_token_hash text,
  p_listing_id uuid,
  p_payload_hash text,
  p_message_body text
)
returns table (
  intent_id uuid,
  outbox_id uuid,
  delivery_status text,
  delivery_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sender uuid := auth.uid();
  v_intent private.contact_intents%rowtype;
  v_outbox private.contact_outbox%rowtype;
begin
  if v_sender is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;
  select * into v_intent from private.contact_intents
  where token_hash = p_token_hash and sender_id = v_sender
  for update;
  if not found or v_intent.expires_at <= now()
    or v_intent.listing_id <> p_listing_id
    or v_intent.payload_hash <> p_payload_hash
    or v_intent.message_body <> p_message_body
  then
    raise exception using errcode = '42501', message = 'contact intent unavailable';
  end if;
  if not exists (
    select 1 from public.listings l where l.id = p_listing_id
      and l.owner_id <> v_sender
      and public.listing_is_contactable(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
  ) then
    raise exception using errcode = '42501', message = 'listing unavailable';
  end if;

  if v_intent.used_at is null then
    update private.contact_intents set used_at = now() where id = v_intent.id;
    insert into private.contact_outbox (
      intent_id, sender_id, listing_id, message_body, payload_hash, idempotency_key
    ) values (
      v_intent.id, v_sender, p_listing_id, p_message_body, p_payload_hash,
      'contact/' || v_intent.id::text
    ) on conflict (intent_id) do nothing;
  end if;
  select * into v_outbox from private.contact_outbox where intent_id = v_intent.id;
  if not found then raise exception using errcode = 'XX000', message = 'contact queue unavailable'; end if;
  return query select v_intent.id, v_outbox.id, v_outbox.status::text, v_outbox.updated_at;
end;
$$;

create function public.get_own_contact_status(p_intent_id uuid)
returns table (
  intent_id uuid,
  outbox_id uuid,
  delivery_status text,
  delivery_updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, private, auth
as $$
  select i.id, o.id, o.status::text, o.updated_at
  from private.contact_intents i
  join private.contact_outbox o on o.intent_id = i.id
  where i.id = p_intent_id and i.sender_id = auth.uid();
$$;

create function public.admin_lease_contact_outbox(p_limit integer, p_lease_token uuid)
returns table (
  outbox_id uuid,
  listing_id uuid,
  listing_title text,
  message_body text,
  idempotency_key text,
  owner_email text,
  sender_email text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
begin
  return query
  with candidates as (
    select o.id from private.contact_outbox o
    where (
      (o.status in ('queued', 'retrying') and o.available_at <= now())
      or (o.status = 'sending' and o.leased_until <= now())
    )
      and o.attempts < 5
      and (o.first_attempt_at is null or o.first_attempt_at > now() - interval '23 hours')
    order by o.available_at, o.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 25)
  ), leased as (
    update private.contact_outbox o
    set status = 'sending', lease_token = p_lease_token,
        leased_until = now() + interval '2 minutes', attempts = o.attempts + 1,
        first_attempt_at = coalesce(o.first_attempt_at, now()), updated_at = now()
    from candidates c where o.id = c.id
    returning o.*
  )
  select l.id, l.listing_id, listings.title, l.message_body, l.idempotency_key,
    owner_user.email::text, sender_user.email::text, l.attempts
  from leased l
  join public.listings on listings.id = l.listing_id
  join auth.users owner_user on owner_user.id = listings.owner_id
  join auth.users sender_user on sender_user.id = l.sender_id;
end;
$$;

create function private.apply_contact_delivery_projection(p_provider_email_id text)
returns void
language plpgsql
set search_path = pg_catalog, private
as $$
declare
  v_type text;
  v_status private.contact_delivery_status;
begin
  select event_type into v_type from private.contact_provider_events
  where provider_email_id = p_provider_email_id
  order by case event_type
    when 'email.complained' then 60 when 'email.suppressed' then 60 when 'email.bounced' then 50
    when 'email.failed' then 40 when 'email.delivered' then 30
    when 'email.delivery_delayed' then 20 else 10 end desc,
    occurred_at desc limit 1;
  if not found then return; end if;
  v_status := case v_type when 'email.complained' then 'suppressed' when 'email.suppressed' then 'suppressed'
    when 'email.bounced' then 'bounced' when 'email.failed' then 'failed'
    when 'email.delivered' then 'delivered' when 'email.delivery_delayed' then 'delayed'
    else 'accepted' end;
  update private.contact_outbox
  set status = v_status, updated_at = now(),
      delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
      terminal_at = case when v_status in ('bounced', 'suppressed', 'failed') then now() else terminal_at end
  where provider_email_id = p_provider_email_id
    and case status when 'queued' then 0 when 'sending' then 1 when 'accepted' then 2
      when 'retrying' then 1 when 'delayed' then 3 when 'delivered' then 4 else 5 end
      <= case v_status when 'accepted' then 2 when 'delayed' then 3 when 'delivered' then 4 else 5 end;
  update private.contact_provider_events set applied_at = now()
  where provider_email_id = p_provider_email_id and applied_at is null;
end;
$$;

create function public.admin_mark_contact_accepted(
  p_outbox_id uuid, p_lease_token uuid, p_provider_email_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update private.contact_outbox set status = 'accepted', provider_email_id = p_provider_email_id,
    accepted_at = now(), updated_at = now(), lease_token = null, leased_until = null, error_code = null
  where id = p_outbox_id and lease_token = p_lease_token and status = 'sending';
  if not found then return false; end if;
  perform private.apply_contact_delivery_projection(p_provider_email_id);
  return true;
end;
$$;

create function public.admin_retry_contact_outbox(
  p_outbox_id uuid, p_lease_token uuid, p_error_code text, p_retryable boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  update private.contact_outbox
  set status = case when p_retryable and attempts < 5 and first_attempt_at > now() - interval '23 hours' then 'retrying'::private.contact_delivery_status else 'failed'::private.contact_delivery_status end,
      available_at = case when p_retryable then now() + make_interval(secs => least(900, 30 * attempts * attempts)) else available_at end,
      terminal_at = case when p_retryable and attempts < 5 and first_attempt_at > now() - interval '23 hours' then null else now() end,
      error_code = left(p_error_code, 80), lease_token = null, leased_until = null, updated_at = now()
  where id = p_outbox_id and lease_token = p_lease_token and status = 'sending';
  return found;
end;
$$;

create function public.admin_apply_resend_event(
  p_event_id text, p_provider_email_id text, p_event_type text, p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into private.contact_provider_events (event_id, provider_email_id, event_type, occurred_at)
  values (p_event_id, p_provider_email_id, p_event_type, p_occurred_at)
  on conflict (event_id) do nothing;
  if not found then return false; end if;
  perform private.apply_contact_delivery_projection(p_provider_email_id);
  return true;
end;
$$;

revoke all on private.contact_intents, private.contact_outbox, private.contact_provider_events from public, anon, authenticated;
grant all on private.contact_intents, private.contact_outbox, private.contact_provider_events to service_role;
grant usage, select on all sequences in schema private to service_role;

revoke execute on function public.issue_contact_intent(uuid, uuid, uuid, text, text, text, timestamptz) from public, anon;
revoke execute on function public.consume_contact_intent(text, uuid, text, text) from public, anon;
revoke execute on function public.get_own_contact_status(uuid) from public, anon;
grant execute on function public.issue_contact_intent(uuid, uuid, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.consume_contact_intent(text, uuid, text, text) to authenticated;
grant execute on function public.get_own_contact_status(uuid) to authenticated;

revoke execute on function public.admin_lease_contact_outbox(integer, uuid) from public, anon, authenticated;
revoke execute on function public.admin_mark_contact_accepted(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_retry_contact_outbox(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.admin_apply_resend_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_lease_contact_outbox(integer, uuid) to service_role;
grant execute on function public.admin_mark_contact_accepted(uuid, uuid, text) to service_role;
grant execute on function public.admin_retry_contact_outbox(uuid, uuid, text, boolean) to service_role;
grant execute on function public.admin_apply_resend_event(text, text, text, timestamptz) to service_role;
