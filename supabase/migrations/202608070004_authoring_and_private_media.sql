create type public.housing_subtype as enum (
  'room', 'studio', 'entire-place', 'shared-room', 'sublet', 'other'
);

alter table public.housing_details
  add column subtype public.housing_subtype not null default 'room';

alter table public.listing_images
  add column generation uuid not null default gen_random_uuid(),
  add column original_media_type text,
  add column byte_size bigint check (byte_size is null or byte_size between 1 and 8388608),
  add column width integer check (width is null or width between 1 and 12000),
  add column height integer check (height is null or height between 1 and 12000),
  add column error_code text check (
    error_code is null or error_code in (
      'missing', 'too-large', 'unsupported', 'corrupt', 'dimensions',
      'animated', 'quota', 'stale', 'storage'
    )
  ),
  add column processing_started_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'listing-staging', 'listing-staging', false, 8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'listing-media', 'listing-media', false, 8388608,
    array['image/webp']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy listing_staging_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-staging'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.listing_images i
    join public.listings l on l.id = i.listing_id
    where i.storage_path = name
      and i.status in ('staged', 'failed')
      and l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
      and l.deleted_at is null
      and public.current_user_is_active()
  )
);

create policy listing_staging_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-staging'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.listing_images i
    join public.listings l on l.id = i.listing_id
    where i.storage_path = name
      and l.owner_id = auth.uid()
      and l.deleted_at is null
  )
);

create policy listing_staging_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'listing-staging'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.listing_images i
    join public.listings l on l.id = i.listing_id
    where i.storage_path = name
      and l.owner_id = auth.uid()
      and public.current_user_is_active()
  )
);

create function public.public_text_is_safe(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select
    p_text !~* '[[:alnum:].!#$%&''*+/=?^_`{|}~-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)+'
    and p_text !~* '(^|[^0-9])\+?[0-9]([ .()/-]*[0-9]){7,}([^0-9]|$)'
    and p_text !~* '(https?://|www\.|chat\.whatsapp\.com|wa\.me/|facebook\.com/groups/|t\.me/)'
    and p_text !~* '(^|[^0-9])[0-9]{1,5}[ ]+([[:alpha:]''-]+[ ]+){0,6}(street|st|road|rd|avenue|ave|lane|ln|boulevard|blvd|calle|carrer|rue|strasse|via)([^[:alpha:]]|$)'
    and p_text !~* '(^|[^[:alpha:]])(street|road|avenue|lane|boulevard|calle|carrer|rue|strasse|via)[^,;\n]{0,70}[0-9]{1,5}([^0-9]|$)';
$$;

create function public.validate_public_listing_text()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'listings' then
    if not public.public_text_is_safe(new.title)
      or not public.public_text_is_safe(new.description)
      or not public.public_text_is_safe(new.approximate_area)
    then
      raise exception using errcode = '23514', message = 'listing public text is unsafe';
    end if;
  elsif tg_table_name = 'item_details'
    and not public.public_text_is_safe(new.pickup_area)
  then
    raise exception using errcode = '23514', message = 'item pickup area is unsafe';
  end if;
  return new;
end;
$$;

create trigger listings_validate_public_text
before insert or update of title, description, approximate_area on public.listings
for each row execute function public.validate_public_listing_text();
create trigger item_details_validate_public_text
before insert or update of pickup_area on public.item_details
for each row execute function public.validate_public_listing_text();

create function public.save_own_listing(
  p_listing_id uuid,
  p_expected_version bigint,
  p_kind public.listing_kind,
  p_city_id uuid,
  p_organization_ids uuid[],
  p_resource_category_id uuid,
  p_title text,
  p_description text,
  p_price_amount numeric,
  p_currency text,
  p_approximate_area text,
  p_available_from date,
  p_expires_at timestamptz,
  p_housing_subtype public.housing_subtype,
  p_furnished boolean,
  p_bills_included boolean,
  p_publication_rights_acknowledged boolean,
  p_permission_acknowledged boolean,
  p_safety_warning_acknowledged boolean,
  p_item_condition public.item_condition,
  p_quantity integer,
  p_pickup_area text,
  p_is_giveaway boolean,
  p_publish boolean
)
returns table (
  listing_id uuid,
  listing_version bigint,
  listing_status public.listing_status
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid := coalesce(p_listing_id, gen_random_uuid());
  v_owner uuid := auth.uid();
  v_existing public.listings%rowtype;
  v_status public.listing_status;
  v_version bigint;
  v_org_count integer;
begin
  if v_owner is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;

  p_organization_ids := coalesce(p_organization_ids, '{}'::uuid[]);
  select count(distinct value) into v_org_count
  from unnest(p_organization_ids) as organization_id(value);
  if cardinality(p_organization_ids) > 8
    or v_org_count <> cardinality(p_organization_ids)
  then
    raise exception using errcode = '23514', message = 'organization tags are invalid';
  end if;

  if p_expires_at <= now() then
    raise exception using errcode = '23514', message = 'listing expiry must be in the future';
  end if;
  if not public.public_text_is_safe(p_title)
    or not public.public_text_is_safe(p_description)
    or not public.public_text_is_safe(p_approximate_area)
    or (p_pickup_area is not null and not public.public_text_is_safe(p_pickup_area))
  then
    raise exception using errcode = '23514', message = 'listing public text is unsafe';
  end if;

  if p_kind = 'housing' then
    if p_housing_subtype is null
      or p_furnished is null
      or p_bills_included is null
      or p_publication_rights_acknowledged is not true
      or p_permission_acknowledged is not true
      or p_safety_warning_acknowledged is not true
      or p_item_condition is not null
      or p_quantity is not null
      or p_pickup_area is not null
      or p_is_giveaway is not null
    then
      raise exception using errcode = '23514', message = 'housing details are invalid';
    end if;
  elsif p_kind = 'item' then
    if p_item_condition is null
      or p_quantity is null
      or p_pickup_area is null
      or p_is_giveaway is null
      or p_housing_subtype is not null
      or p_furnished is not null
      or p_bills_included is not null
      or p_publication_rights_acknowledged is not null
      or p_permission_acknowledged is not null
      or p_safety_warning_acknowledged is not null
    then
      raise exception using errcode = '23514', message = 'item details are invalid';
    end if;
  end if;

  if p_listing_id is null then
    insert into public.listings (
      id, owner_id, city_id, resource_category_id, kind, title, description,
      price_amount, currency, approximate_area, available_from, expires_at,
      source, status
    ) values (
      v_id, v_owner, p_city_id, p_resource_category_id, p_kind, p_title,
      p_description, p_price_amount, p_currency, p_approximate_area,
      p_available_from, p_expires_at, 'self',
      case when p_publish then 'active'::public.listing_status else 'draft'::public.listing_status end
    )
    returning version, status into v_version, v_status;
  else
    select * into v_existing
    from public.listings
    where id = p_listing_id
    for update;

    if not found or v_existing.owner_id <> v_owner or v_existing.deleted_at is not null then
      raise exception using errcode = '42501', message = 'listing unavailable';
    end if;
    if v_existing.status not in ('draft', 'active', 'reserved') then
      raise exception using errcode = '23514', message = 'listing cannot be edited';
    end if;
    if p_expected_version is null or v_existing.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'stale listing version';
    end if;

    update public.listings
    set city_id = p_city_id,
        resource_category_id = p_resource_category_id,
        kind = p_kind,
        title = p_title,
        description = p_description,
        price_amount = p_price_amount,
        currency = p_currency,
        approximate_area = p_approximate_area,
        available_from = p_available_from,
        expires_at = p_expires_at,
        status = case
          when p_publish then 'active'::public.listing_status
          else v_existing.status
        end
    where id = v_id and version = p_expected_version
    returning version, status into v_version, v_status;

    if not found then
      raise exception using errcode = '40001', message = 'stale listing version';
    end if;
  end if;

  delete from public.housing_details where listing_id = v_id;
  delete from public.item_details where listing_id = v_id;

  if p_kind = 'housing' then
    insert into public.housing_details (
      listing_id, subtype, furnished, bills_included,
      publication_rights_acknowledged, permission_acknowledged,
      safety_warning_acknowledged
    ) values (
      v_id, p_housing_subtype, p_furnished, p_bills_included,
      p_publication_rights_acknowledged, p_permission_acknowledged,
      p_safety_warning_acknowledged
    );
  else
    insert into public.item_details (
      listing_id, condition, quantity, pickup_area, is_giveaway
    ) values (
      v_id, p_item_condition, p_quantity, p_pickup_area, p_is_giveaway
    );
  end if;

  delete from public.listing_organizations where listing_id = v_id;
  insert into public.listing_organizations (listing_id, organization_id)
  select v_id, value
  from unnest(p_organization_ids) as organization_id(value);

  if p_publish and exists (
    select 1 from public.listing_images
    where listing_id = v_id and status not in ('ready', 'deleted')
  ) then
    raise exception using errcode = '23514', message = 'listing images are not ready';
  end if;

  return query select v_id, v_version, v_status;
end;
$$;

create function public.stage_own_listing_image(
  p_listing_id uuid,
  p_sort_order smallint,
  p_original_media_type text,
  p_byte_size bigint
)
returns table (
  image_id uuid,
  storage_path text,
  generation uuid,
  image_status public.image_processing_status
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_image_id uuid := gen_random_uuid();
  v_generation uuid := gen_random_uuid();
  v_storage_path text;
  v_count integer;
  v_account_bytes bigint;
begin
  if v_owner is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;
  if p_original_media_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 8388608
    or p_sort_order not between 0 and 9
  then
    raise exception using errcode = '23514', message = 'image candidate is invalid';
  end if;
  if not exists (
    select 1 from public.listings
    where id = p_listing_id and owner_id = v_owner
      and deleted_at is null and status in ('draft', 'active', 'reserved')
  ) then
    raise exception using errcode = '42501', message = 'listing unavailable';
  end if;

  select count(*) into v_count
  from public.listing_images
  where listing_id = p_listing_id and status <> 'deleted';
  if v_count >= 10 then
    raise exception using errcode = '23514', message = 'listing image limit reached';
  end if;

  select coalesce(sum(i.byte_size), 0) into v_account_bytes
  from public.listing_images i
  join public.listings l on l.id = i.listing_id
  where l.owner_id = v_owner and i.status <> 'deleted';
  if v_account_bytes + p_byte_size > 209715200 then
    raise exception using errcode = '23514', message = 'account image quota reached';
  end if;

  v_storage_path := v_owner::text || '/' || p_listing_id::text || '/' || v_image_id::text || '.upload';
  insert into public.listing_images (
    id, listing_id, storage_path, generation, original_media_type,
    byte_size, sort_order, status
  ) values (
    v_image_id, p_listing_id, v_storage_path, v_generation,
    p_original_media_type, p_byte_size, p_sort_order, 'staged'
  );

  return query select v_image_id, v_storage_path, v_generation, 'staged'::public.image_processing_status;
end;
$$;

create function public.remove_own_listing_image(p_image_id uuid, p_generation uuid)
returns table (staging_path text, media_path text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_staging text;
  v_media text;
begin
  if not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active verified member required';
  end if;
  select i.storage_path, i.derivative_path into v_staging, v_media
  from public.listing_images i
  join public.listings l on l.id = i.listing_id
  where i.id = p_image_id
    and i.generation = p_generation
    and i.status <> 'deleted'
    and l.owner_id = auth.uid()
  for update of i;
  if not found then
    raise exception using errcode = '40001', message = 'stale image version';
  end if;

  update public.listing_images i
  set status = 'deleted', generation = gen_random_uuid(), derivative_path = null,
      content_digest = null, error_code = null
  where i.id = p_image_id
    and i.generation = p_generation;
  return query select v_staging, v_media;
end;
$$;

create function public.admin_claim_listing_image(
  p_image_id uuid,
  p_listing_id uuid,
  p_owner_id uuid,
  p_generation uuid
)
returns table (storage_path text, generation uuid, declared_byte_size bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  update public.listing_images i
  set status = 'processing', processing_started_at = now(), error_code = null
  from public.listings l
  where i.id = p_image_id
    and i.listing_id = p_listing_id
    and i.generation = p_generation
    and i.status in ('staged', 'failed')
    and l.id = i.listing_id
    and l.owner_id = p_owner_id
    and l.deleted_at is null
  returning i.storage_path, i.generation, i.byte_size;
end;
$$;

create function public.admin_mark_listing_image_ready(
  p_image_id uuid,
  p_generation uuid,
  p_derivative_path text,
  p_content_digest text,
  p_width integer,
  p_height integer,
  p_byte_size bigint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.listing_images
  set status = 'ready', derivative_path = p_derivative_path,
      content_digest = p_content_digest, width = p_width, height = p_height,
      byte_size = p_byte_size, error_code = null
  where id = p_image_id and generation = p_generation and status = 'processing';
  return found;
end;
$$;

create function public.admin_mark_listing_image_failed(
  p_image_id uuid,
  p_generation uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.listing_images
  set status = 'failed', error_code = p_error_code
  where id = p_image_id and generation = p_generation and status = 'processing';
  return found;
end;
$$;

create function public.admin_get_listing_image_access(p_image_id uuid)
returns table (
  owner_id uuid,
  derivative_path text,
  listing_public boolean,
  image_generation uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    l.owner_id,
    i.derivative_path,
    public.listing_is_public(
      l.status, l.moderation_visible, l.expires_at, l.deleted_at, now()
    ),
    i.generation
  from public.listing_images i
  join public.listings l on l.id = i.listing_id
  where i.id = p_image_id and i.status = 'ready' and i.derivative_path is not null;
$$;

revoke insert, update, delete on public.listings, public.housing_details,
  public.item_details, public.listing_organizations, public.listing_images
  from authenticated;

revoke execute on function public.public_text_is_safe(text) from public, anon, authenticated;
revoke execute on function public.save_own_listing(
  uuid, bigint, public.listing_kind, uuid, uuid[], uuid, text, text, numeric,
  text, text, date, timestamptz, public.housing_subtype, boolean, boolean,
  boolean, boolean, boolean, public.item_condition, integer, text, boolean, boolean
) from public, anon;
revoke execute on function public.stage_own_listing_image(uuid, smallint, text, bigint)
  from public, anon;
revoke execute on function public.remove_own_listing_image(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_claim_listing_image(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.admin_mark_listing_image_ready(
  uuid, uuid, text, text, integer, integer, bigint
) from public, anon, authenticated;
revoke execute on function public.admin_mark_listing_image_failed(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.admin_get_listing_image_access(uuid)
  from public, anon, authenticated;

grant execute on function public.save_own_listing(
  uuid, bigint, public.listing_kind, uuid, uuid[], uuid, text, text, numeric,
  text, text, date, timestamptz, public.housing_subtype, boolean, boolean,
  boolean, boolean, boolean, public.item_condition, integer, text, boolean, boolean
) to authenticated;
grant execute on function public.stage_own_listing_image(uuid, smallint, text, bigint)
  to authenticated;
grant execute on function public.remove_own_listing_image(uuid, uuid)
  to authenticated;
grant execute on function public.admin_claim_listing_image(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.admin_mark_listing_image_ready(
  uuid, uuid, text, text, integer, integer, bigint
) to service_role;
grant execute on function public.admin_mark_listing_image_failed(uuid, uuid, text)
  to service_role;
grant execute on function public.admin_get_listing_image_access(uuid)
  to service_role;

comment on table public.listing_images is
  'Private media state. Originals remain in listing-staging; metadata-free WebP derivatives remain in private listing-media.';
