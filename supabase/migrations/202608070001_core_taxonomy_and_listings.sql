create extension if not exists pgcrypto with schema extensions;

create type public.taxonomy_status as enum ('active', 'retired');
create type public.listing_kind as enum ('housing', 'item');
create type public.listing_status as enum (
  'draft',
  'active',
  'reserved',
  'completed',
  'expired',
  'withdrawn'
);
create type public.listing_source as enum ('self', 'assisted');
create type public.item_condition as enum ('new', 'like-new', 'good', 'fair', 'poor');
create type public.image_processing_status as enum (
  'staged',
  'processing',
  'ready',
  'failed',
  'deleted'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted')),
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((account_status = 'deleted') = (deleted_at is not null))
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null,
  status public.taxonomy_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 160),
  status public.taxonomy_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_city_slug_unique
  on public.organizations (city_id, slug)
  where city_id is not null;
create unique index organizations_global_slug_unique
  on public.organizations (slug)
  where city_id is null;

create table public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  kind public.listing_kind not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 2 and 100),
  status public.taxonomy_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug),
  unique (id, kind)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  resource_category_id uuid not null,
  kind public.listing_kind not null,
  title text not null check (char_length(title) between 8 and 120),
  description text not null check (char_length(description) between 20 and 4000),
  price_amount numeric(12, 2) not null check (price_amount between 0 and 1000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  approximate_area text not null check (char_length(approximate_area) between 2 and 120),
  available_from date not null,
  expires_at timestamptz not null,
  source public.listing_source not null default 'self',
  status public.listing_status not null default 'draft',
  moderation_visible boolean not null default true,
  published_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_category_kind_fk
    foreign key (resource_category_id, kind)
    references public.resource_categories (id, kind)
    on delete restrict,
  check (expires_at > created_at),
  check (deleted_at is null or status in ('completed', 'expired', 'withdrawn'))
);

create table public.listing_organizations (
  listing_id uuid not null references public.listings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (listing_id, organization_id)
);

create table public.housing_details (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  furnished boolean not null,
  bills_included boolean not null,
  publication_rights_acknowledged boolean not null
    check (publication_rights_acknowledged),
  permission_acknowledged boolean not null
    check (permission_acknowledged),
  safety_warning_acknowledged boolean not null
    check (safety_warning_acknowledged),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.item_details (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  condition public.item_condition not null,
  quantity integer not null check (quantity between 1 and 100),
  pickup_area text not null check (char_length(pickup_area) between 2 and 120),
  is_giveaway boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique check (storage_path !~ '(^|/)\.\.(/|$)'),
  derivative_path text unique check (
    derivative_path is null or derivative_path !~ '(^|/)\.\.(/|$)'
  ),
  content_digest text check (content_digest is null or content_digest ~ '^[a-f0-9]{64}$'),
  status public.image_processing_status not null default 'staged',
  sort_order smallint not null default 0 check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, sort_order),
  check (
    status <> 'ready'
    or (derivative_path is not null and content_digest is not null)
  )
);

create index listings_public_feed_idx
  on public.listings (city_id, kind, status, expires_at desc)
  where moderation_visible and deleted_at is null;
create index listings_owner_updated_idx
  on public.listings (owner_id, updated_at desc);
create index listings_category_feed_idx
  on public.listings (resource_category_id, expires_at desc)
  where moderation_visible and deleted_at is null;
create index listing_organizations_organization_idx
  on public.listing_organizations (organization_id, listing_id);
create index organizations_city_status_idx
  on public.organizations (city_id, status, name);
create index resource_categories_kind_status_idx
  on public.resource_categories (kind, status, label);
create index listing_images_listing_status_idx
  on public.listing_images (listing_id, status, sort_order);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger cities_set_updated_at
before update on public.cities
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();
create trigger resource_categories_set_updated_at
before update on public.resource_categories
for each row execute function public.set_updated_at();
create trigger housing_details_set_updated_at
before update on public.housing_details
for each row execute function public.set_updated_at();
create trigger item_details_set_updated_at
before update on public.item_details
for each row execute function public.set_updated_at();
create trigger listing_images_set_updated_at
before update on public.listing_images
for each row execute function public.set_updated_at();

create function public.validate_city_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception using
      errcode = '23514',
      message = 'city timezone must be a recognized IANA timezone';
  end if;
  return new;
end;
$$;

create trigger cities_validate_timezone
before insert or update of timezone on public.cities
for each row execute function public.validate_city_timezone();

create function public.listing_is_public(
  p_status public.listing_status,
  p_moderation_visible boolean,
  p_expires_at timestamptz,
  p_deleted_at timestamptz,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
parallel safe
set search_path = pg_catalog
as $$
  select
    p_status in ('active', 'reserved')
    and p_moderation_visible
    and p_deleted_at is null
    and p_expires_at > p_at;
$$;

create function public.listing_is_contactable(
  p_status public.listing_status,
  p_moderation_visible boolean,
  p_expires_at timestamptz,
  p_deleted_at timestamptz,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
parallel safe
set search_path = pg_catalog
as $$
  select
    p_status = 'active'
    and p_moderation_visible
    and p_deleted_at is null
    and p_expires_at > p_at;
$$;

create function public.listing_transition_allowed(
  p_from public.listing_status,
  p_to public.listing_status
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select
    p_from = p_to
    or (p_from = 'draft' and p_to in ('active', 'withdrawn'))
    or (p_from = 'active' and p_to in ('reserved', 'completed', 'expired', 'withdrawn'))
    or (p_from = 'reserved' and p_to in ('active', 'completed', 'expired', 'withdrawn'))
    or (p_from in ('completed', 'expired', 'withdrawn') and p_to = 'active');
$$;

create function public.validate_listing_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  city_status public.taxonomy_status;
  category_status public.taxonomy_status;
begin
  if tg_op = 'INSERT'
    or new.city_id is distinct from old.city_id
    or (new.status = 'active' and old.status is distinct from 'active')
  then
    select status into city_status from public.cities where id = new.city_id;
    if city_status is distinct from 'active' then
      raise exception using errcode = '23514', message = 'listing city is not assignable';
    end if;
  end if;

  if tg_op = 'INSERT'
    or new.resource_category_id is distinct from old.resource_category_id
    or new.kind is distinct from old.kind
    or (new.status = 'active' and old.status is distinct from 'active')
  then
    select status into category_status
    from public.resource_categories
    where id = new.resource_category_id and kind = new.kind;
    if category_status is distinct from 'active' then
      raise exception using errcode = '23514', message = 'listing resource category is not assignable';
    end if;
  end if;

  if tg_op = 'UPDATE' and not public.listing_transition_allowed(old.status, new.status) then
    raise exception using errcode = '23514', message = 'listing lifecycle transition is not allowed';
  end if;

  if new.status in ('active', 'reserved') and new.expires_at <= now() then
    raise exception using errcode = '23514', message = 'public listing expiry must be in the future';
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_validate_write
before insert or update on public.listings
for each row execute function public.validate_listing_write();

create function public.validate_listing_organization()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  listing_city uuid;
  organization_city uuid;
  organization_status public.taxonomy_status;
begin
  select city_id into listing_city
  from public.listings
  where id = new.listing_id;

  select city_id, status into organization_city, organization_status
  from public.organizations
  where id = new.organization_id;

  if organization_status is distinct from 'active' then
    raise exception using errcode = '23514', message = 'organization is not assignable';
  end if;

  if organization_city is not null and organization_city <> listing_city then
    raise exception using errcode = '23514', message = 'organization does not belong to listing city';
  end if;

  return new;
end;
$$;

create trigger listing_organizations_validate
before insert or update on public.listing_organizations
for each row execute function public.validate_listing_organization();

create function public.validate_listing_city_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.listing_organizations lo
    join public.organizations o on o.id = lo.organization_id
    where lo.listing_id = new.id
      and o.city_id is not null
      and o.city_id <> new.city_id
  ) then
    raise exception using errcode = '23514', message = 'existing organization does not belong to new listing city';
  end if;
  return new;
end;
$$;

create trigger listings_validate_city_change
before update of city_id on public.listings
for each row execute function public.validate_listing_city_change();

create function public.validate_listing_kind_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_listing_id uuid;
  target_kind public.listing_kind;
  target_price numeric(12, 2);
  housing_count integer;
  item_count integer;
  giveaway boolean;
begin
  if tg_table_name = 'listings' then
    target_listing_id := coalesce(new.id, old.id);
  else
    target_listing_id := coalesce(new.listing_id, old.listing_id);
  end if;

  select kind, price_amount into target_kind, target_price
  from public.listings
  where id = target_listing_id;

  if not found then
    return null;
  end if;

  select count(*) into housing_count
  from public.housing_details
  where listing_id = target_listing_id;
  select count(*), bool_or(is_giveaway) into item_count, giveaway
  from public.item_details
  where listing_id = target_listing_id;

  if target_kind = 'housing' and (housing_count <> 1 or item_count <> 0) then
    raise exception using errcode = '23514', message = 'housing listing must have exactly one housing detail row';
  end if;
  if target_kind = 'item' and (item_count <> 1 or housing_count <> 0) then
    raise exception using errcode = '23514', message = 'item listing must have exactly one item detail row';
  end if;
  if target_kind = 'item' and giveaway and target_price <> 0 then
    raise exception using errcode = '23514', message = 'giveaway item must have zero price';
  end if;
  if target_kind = 'item' and not giveaway and target_price = 0 then
    raise exception using errcode = '23514', message = 'non-giveaway item must have positive price';
  end if;

  return null;
end;
$$;

create constraint trigger listings_kind_details_check
after insert or update on public.listings
deferrable initially deferred
for each row execute function public.validate_listing_kind_details();
create constraint trigger housing_kind_details_check
after insert or update or delete on public.housing_details
deferrable initially deferred
for each row execute function public.validate_listing_kind_details();
create constraint trigger item_kind_details_check
after insert or update or delete on public.item_details
deferrable initially deferred
for each row execute function public.validate_listing_kind_details();

comment on table public.listings is
  'Public-safe listing content only. Account email, exact housing address, private group evidence, and moderation evidence must never be stored here.';
comment on column public.listings.approximate_area is
  'Neighborhood or broad pickup area; never an exact housing address.';
comment on table public.listing_images is
  'Private object metadata. Browser delivery is mediated by a visibility-checked route.';
