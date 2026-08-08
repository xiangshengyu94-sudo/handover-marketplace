create table private.auth_intents (
  id uuid primary key,
  nonce_hash text not null unique check (char_length(nonce_hash) = 64),
  binding_hash text not null check (char_length(binding_hash) = 64),
  purpose text not null check (purpose in ('login', 'email-change')),
  return_to text not null check (return_to like '/%' and return_to not like '//%'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  superseded_at timestamptz,
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at),
  check (superseded_at is null or superseded_at >= created_at)
);

create unique index auth_intents_one_active_per_browser_purpose
  on private.auth_intents (binding_hash, purpose)
  where consumed_at is null and superseded_at is null;
create index auth_intents_expiry_idx on private.auth_intents (expires_at);

create table private.rate_limit_buckets (
  scope text not null,
  key_hash text not null check (char_length(key_hash) = 64),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_started_at)
);

create table private.captcha_challenges (
  challenge_hash text primary key check (char_length(challenge_hash) = 64),
  consumed_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > consumed_at)
);

alter table private.auth_intents enable row level security;
alter table private.auth_intents force row level security;
alter table private.rate_limit_buckets enable row level security;
alter table private.rate_limit_buckets force row level security;
alter table private.captcha_challenges enable row level security;
alter table private.captcha_challenges force row level security;

create function public.admin_supersede_auth_intents(
  p_binding_hash text,
  p_purpose text,
  p_at timestamptz
)
returns void
language sql
security definer
set search_path = pg_catalog, private
as $$
  update private.auth_intents
  set superseded_at = p_at
  where binding_hash = p_binding_hash
    and purpose = p_purpose
    and consumed_at is null
    and superseded_at is null;
$$;

create function public.admin_create_auth_intent(
  p_id uuid,
  p_nonce_hash text,
  p_binding_hash text,
  p_purpose text,
  p_return_to text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = pg_catalog, private
as $$
  insert into private.auth_intents (
    id, nonce_hash, binding_hash, purpose, return_to, created_at, expires_at
  ) values (
    p_id, p_nonce_hash, p_binding_hash, p_purpose, p_return_to,
    p_created_at, p_expires_at
  );
$$;

create function public.admin_find_auth_intent(p_nonce_hash text)
returns table (
  id uuid,
  nonce_hash text,
  binding_hash text,
  purpose text,
  return_to text,
  created_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  superseded_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select
    i.id, i.nonce_hash, i.binding_hash, i.purpose, i.return_to,
    i.created_at, i.expires_at, i.consumed_at, i.superseded_at
  from private.auth_intents i
  where i.nonce_hash = p_nonce_hash;
$$;

create function public.admin_consume_auth_intent(p_id uuid, p_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  update private.auth_intents
  set consumed_at = p_at
  where id = p_id
    and consumed_at is null
    and superseded_at is null
    and expires_at > p_at;
  return found;
end;
$$;

create function public.admin_consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, attempt_count integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate-limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into private.rate_limit_buckets (
    scope, key_hash, window_started_at, attempt_count, updated_at
  ) values (p_scope, p_key_hash, v_window_start, 1, v_now)
  on conflict (scope, key_hash, window_started_at)
  do update set
    attempt_count = private.rate_limit_buckets.attempt_count + 1,
    updated_at = excluded.updated_at
  returning private.rate_limit_buckets.attempt_count into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
    );
end;
$$;

create function public.admin_consume_captcha_challenge(
  p_challenge_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  insert into private.captcha_challenges (challenge_hash, expires_at)
  values (p_challenge_hash, p_expires_at)
  on conflict (challenge_hash) do nothing;
  return found;
end;
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.user_id = auth.uid()
      and p.account_status = 'active'
      and p.deleted_at is null
      and u.email_confirmed_at is not null
      and u.new_email is null
  );
$$;

revoke all on private.auth_intents, private.rate_limit_buckets,
  private.captcha_challenges from public, anon, authenticated;
revoke execute on function public.admin_supersede_auth_intents(text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_create_auth_intent(
  uuid, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke execute on function public.admin_find_auth_intent(text)
  from public, anon, authenticated;
revoke execute on function public.admin_consume_auth_intent(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.admin_consume_captcha_challenge(text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.admin_supersede_auth_intents(text, text, timestamptz)
  to service_role;
grant execute on function public.admin_create_auth_intent(
  uuid, text, text, text, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.admin_find_auth_intent(text) to service_role;
grant execute on function public.admin_consume_auth_intent(uuid, timestamptz)
  to service_role;
grant execute on function public.admin_consume_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.admin_consume_captcha_challenge(text, timestamptz)
  to service_role;
