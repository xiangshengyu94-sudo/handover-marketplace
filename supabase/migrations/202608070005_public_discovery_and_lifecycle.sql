create table private.listing_status_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete restrict,
  actor_id uuid not null references auth.users (id) on delete restrict,
  from_status public.listing_status not null,
  to_status public.listing_status not null,
  listing_version bigint not null,
  action text not null check (action in ('reserve', 'reopen', 'complete', 'withdraw', 'renew', 'delete')),
  created_at timestamptz not null default now()
);

create table private.cache_invalidation_outbox (
  id bigint generated always as identity primary key,
  aggregate_type text not null check (aggregate_type = 'listing'),
  aggregate_id uuid not null,
  aggregate_version bigint not null,
  reason text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (aggregate_type, aggregate_id, aggregate_version)
);

alter table private.listing_status_history enable row level security;
alter table private.listing_status_history force row level security;
alter table private.cache_invalidation_outbox enable row level security;
alter table private.cache_invalidation_outbox force row level security;

create function public.get_public_listing_images(p_listing_id uuid)
returns table (image_id uuid, sort_order smallint, width integer, height integer)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select i.id, i.sort_order, i.width, i.height
  from public.listing_images i
  join public.listings l on l.id = i.listing_id
  where i.listing_id = p_listing_id
    and i.status = 'ready'
    and public.listing_is_public(
      l.status, l.moderation_visible, l.expires_at, l.deleted_at, now()
    )
  order by i.sort_order, i.id;
$$;

create function public.transition_own_listing(
  p_listing_id uuid,
  p_expected_version bigint,
  p_action text,
  p_new_expiry timestamptz default null
)
returns table (listing_id uuid, listing_version bigint, listing_status public.listing_status)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_target public.listing_status;
  v_version bigint;
begin
  if v_owner is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;
  select * into v_listing from public.listings
  where id = p_listing_id and owner_id = v_owner and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'listing unavailable';
  end if;
  if v_listing.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale listing version';
  end if;

  v_target := case p_action
    when 'reserve' then 'reserved'::public.listing_status
    when 'reopen' then 'active'::public.listing_status
    when 'complete' then 'completed'::public.listing_status
    when 'withdraw' then 'withdrawn'::public.listing_status
    when 'renew' then 'active'::public.listing_status
    when 'delete' then 'withdrawn'::public.listing_status
    else null
  end;
  if v_target is null
    or (p_action = 'reserve' and v_listing.status <> 'active')
    or (p_action = 'reopen' and v_listing.status <> 'reserved')
    or (p_action = 'complete' and v_listing.status not in ('active', 'reserved'))
    or (p_action = 'withdraw' and v_listing.status not in ('draft', 'active', 'reserved'))
    or (p_action = 'renew' and v_listing.status not in ('active', 'reserved', 'expired', 'withdrawn'))
    or (p_action = 'delete' and v_listing.status not in ('draft', 'active', 'reserved', 'completed', 'expired', 'withdrawn'))
  then
    raise exception using errcode = '23514', message = 'listing lifecycle action is not allowed';
  end if;
  if p_action = 'renew' and (
    p_new_expiry is null or p_new_expiry <= now() or p_new_expiry > now() + interval '180 days'
  ) then
    raise exception using errcode = '23514', message = 'renewal expiry is invalid';
  end if;

  if p_action = 'delete' and v_listing.status in ('completed', 'expired', 'withdrawn') then
    v_target := v_listing.status;
  elsif p_action = 'renew' and v_listing.status in ('active', 'reserved') then
    v_target := v_listing.status;
  end if;

  update public.listings
  set status = v_target,
      expires_at = case when p_action = 'renew' then p_new_expiry else expires_at end,
      deleted_at = case when p_action = 'delete' then now() else deleted_at end
  where id = p_listing_id and version = p_expected_version
  returning version into v_version;
  if not found then
    raise exception using errcode = '40001', message = 'stale listing version';
  end if;

  insert into private.listing_status_history (
    listing_id, actor_id, from_status, to_status, listing_version, action
  ) values (
    p_listing_id, v_owner, v_listing.status, v_target, v_version, p_action
  );
  insert into private.cache_invalidation_outbox (
    aggregate_type, aggregate_id, aggregate_version, reason
  ) values ('listing', p_listing_id, v_version, 'lifecycle:' || p_action);

  return query select p_listing_id, v_version, v_target;
end;
$$;

revoke all on private.listing_status_history, private.cache_invalidation_outbox
  from public, anon, authenticated;
grant all on private.listing_status_history, private.cache_invalidation_outbox to service_role;
grant usage, select on all sequences in schema private to service_role;
revoke execute on function public.get_public_listing_images(uuid) from public;
revoke execute on function public.transition_own_listing(uuid, bigint, text, timestamptz)
  from public, anon;
grant execute on function public.get_public_listing_images(uuid) to anon, authenticated;
grant execute on function public.transition_own_listing(uuid, bigint, text, timestamptz)
  to authenticated;

comment on table private.cache_invalidation_outbox is
  'Durable record of cache invalidation work; application reads remain fail-closed through database visibility predicates.';
