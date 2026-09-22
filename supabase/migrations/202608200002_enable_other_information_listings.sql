insert into public.resource_categories (id, kind, slug, label, status)
values (
  '30000000-0000-4000-8000-000000000007',
  'other',
  'other',
  'Other',
  'active'
)
on conflict (kind, slug) do update set
  label = excluded.label,
  status = excluded.status;

create or replace function public.validate_listing_kind_details()
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
  if target_kind = 'other' and (housing_count <> 0 or item_count <> 0) then
    raise exception using errcode = '23514', message = 'other listing must not have housing or item detail rows';
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

create or replace function public.save_own_other_listing(
  p_listing_id uuid,
  p_expected_version bigint,
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
  then
    raise exception using errcode = '23514', message = 'listing public text is unsafe';
  end if;

  if p_listing_id is null then
    insert into public.listings (
      id, owner_id, city_id, resource_category_id, kind, title, description,
      price_amount, currency, approximate_area, available_from, expires_at,
      source, status
    ) values (
      v_id, v_owner, p_city_id, p_resource_category_id, 'other', p_title,
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
        kind = 'other',
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

  delete from public.housing_details h where h.listing_id = v_id;
  delete from public.item_details i where i.listing_id = v_id;

  delete from public.listing_organizations lo where lo.listing_id = v_id;
  insert into public.listing_organizations (listing_id, organization_id)
  select v_id, value
  from unnest(p_organization_ids) as organization_id(value);

  if p_publish and exists (
    select 1 from public.listing_images i
    where i.listing_id = v_id and i.status not in ('ready', 'deleted')
  ) then
    raise exception using errcode = '23514', message = 'listing images are not ready';
  end if;

  return query select v_id, v_version, v_status;
end;
$$;

revoke execute on function public.save_own_other_listing(
  uuid, bigint, uuid, uuid[], uuid, text, text, numeric, text, text, date,
  timestamptz, boolean
) from public, anon;
grant execute on function public.save_own_other_listing(
  uuid, bigint, uuid, uuid[], uuid, text, text, numeric, text, text, date,
  timestamptz, boolean
) to authenticated;

comment on function public.save_own_other_listing(
  uuid, bigint, uuid, uuid[], uuid, text, text, numeric, text, text, date,
  timestamptz, boolean
) is 'Atomically creates or updates a generic community-information listing without housing or item detail rows.';
