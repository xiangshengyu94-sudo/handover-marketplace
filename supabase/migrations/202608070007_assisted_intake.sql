create type private.assisted_claim_status as enum ('pending', 'claimed', 'rejected', 'expired', 'revoked');

create table private.assisted_claims (
  id uuid primary key,
  listing_id uuid not null unique references public.listings (id) on delete restrict,
  operator_id uuid not null references auth.users (id) on delete restrict,
  claimant_id uuid references auth.users (id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  author_email_hmac text not null check (author_email_hmac ~ '^[a-f0-9]{64}$'),
  source_label text not null check (char_length(source_label) between 2 and 120),
  authorization_attested_at timestamptz not null,
  status private.assisted_claim_status not null default 'pending',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (consumed_at is null)),
  check (expires_at > created_at)
);

alter table private.assisted_claims enable row level security;
alter table private.assisted_claims force row level security;
revoke all on private.assisted_claims from public, anon, authenticated;
grant all on private.assisted_claims to service_role;

create function public.guard_pending_assisted_draft()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if old.source = 'assisted'
    and new.status <> 'draft'
    and exists (
      select 1 from private.assisted_claims c
      where c.listing_id = old.id and c.status = 'pending'
    )
  then
    raise exception using errcode = '42501', message = 'assisted draft must be claimed before publication';
  end if;
  return new;
end;
$$;

create trigger listings_guard_pending_assisted_draft
before update on public.listings
for each row execute function public.guard_pending_assisted_draft();

create function public.admin_create_assisted_draft(
  p_operator_id uuid,
  p_listing_id uuid,
  p_claim_id uuid,
  p_token_hash text,
  p_author_email_hmac text,
  p_source_label text,
  p_expires_at timestamptz,
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
  p_listing_expires_at timestamptz,
  p_housing_subtype public.housing_subtype,
  p_furnished boolean,
  p_bills_included boolean,
  p_publication_rights_acknowledged boolean,
  p_permission_acknowledged boolean,
  p_safety_warning_acknowledged boolean,
  p_item_condition public.item_condition,
  p_quantity integer,
  p_pickup_area text,
  p_is_giveaway boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_org_count integer;
begin
  if not exists (select 1 from private.user_roles where user_id = p_operator_id and role = 'operator')
    or not exists (select 1 from public.profiles where user_id = p_operator_id and account_status = 'active' and deleted_at is null)
  then raise exception using errcode = '42501', message = 'authorized operator required'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days'
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_author_email_hmac !~ '^[a-f0-9]{64}$'
    or char_length(p_source_label) not between 2 and 120
  then raise exception using errcode = '23514', message = 'assisted claim is invalid'; end if;
  if not public.public_text_is_safe(p_title) or not public.public_text_is_safe(p_description)
    or not public.public_text_is_safe(p_approximate_area)
    or (p_pickup_area is not null and not public.public_text_is_safe(p_pickup_area))
  then raise exception using errcode = '23514', message = 'assisted public text is unsafe'; end if;
  if not exists (select 1 from public.cities where id = p_city_id and status = 'active')
    or not exists (select 1 from public.resource_categories where id = p_resource_category_id and kind = p_kind and status = 'active')
  then raise exception using errcode = '23514', message = 'assisted taxonomy is invalid'; end if;
  p_organization_ids := coalesce(p_organization_ids, '{}'::uuid[]);
  select count(distinct value) into v_org_count from unnest(p_organization_ids) as organization_id(value);
  if cardinality(p_organization_ids) > 8 or v_org_count <> cardinality(p_organization_ids)
  then raise exception using errcode = '23514', message = 'assisted organizations are invalid'; end if;

  insert into public.listings (
    id, owner_id, city_id, resource_category_id, kind, title, description,
    price_amount, currency, approximate_area, available_from, expires_at, source, status
  ) values (
    p_listing_id, p_operator_id, p_city_id, p_resource_category_id, p_kind,
    p_title, p_description, p_price_amount, p_currency, p_approximate_area,
    p_available_from, p_listing_expires_at, 'assisted', 'draft'
  );
  if p_kind = 'housing' then
    if p_housing_subtype is null or p_furnished is null or p_bills_included is null
      or p_publication_rights_acknowledged is not true or p_permission_acknowledged is not true
      or p_safety_warning_acknowledged is not true or p_item_condition is not null
      or p_quantity is not null or p_pickup_area is not null or p_is_giveaway is not null
    then raise exception using errcode = '23514', message = 'assisted housing is invalid'; end if;
    insert into public.housing_details (listing_id, subtype, furnished, bills_included, publication_rights_acknowledged, permission_acknowledged, safety_warning_acknowledged)
    values (p_listing_id, p_housing_subtype, p_furnished, p_bills_included, true, true, true);
  else
    if p_item_condition is null or p_quantity is null or p_pickup_area is null or p_is_giveaway is null
      or p_housing_subtype is not null or p_furnished is not null or p_bills_included is not null
      or p_publication_rights_acknowledged is not null or p_permission_acknowledged is not null
      or p_safety_warning_acknowledged is not null
    then raise exception using errcode = '23514', message = 'assisted item is invalid'; end if;
    insert into public.item_details (listing_id, condition, quantity, pickup_area, is_giveaway)
    values (p_listing_id, p_item_condition, p_quantity, p_pickup_area, p_is_giveaway);
  end if;
  insert into public.listing_organizations (listing_id, organization_id)
  select p_listing_id, value from unnest(p_organization_ids) as organization_id(value);
  insert into private.assisted_claims (
    id, listing_id, operator_id, token_hash, author_email_hmac, source_label,
    authorization_attested_at, expires_at
  ) values (
    p_claim_id, p_listing_id, p_operator_id, p_token_hash, p_author_email_hmac,
    p_source_label, now(), p_expires_at
  );
  return p_listing_id;
end;
$$;

create function public.admin_inspect_assisted_claim(
  p_token_hash text, p_claimant_id uuid, p_author_email_hmac text
)
returns table (
  claim_id uuid, listing_id uuid, title text, description text,
  kind public.listing_kind, approximate_area text, source_label text, expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
begin
  update private.assisted_claims set status = 'expired', consumed_at = now(), updated_at = now()
  where token_hash = p_token_hash and status = 'pending' and expires_at <= now();
  return query
  select c.id, l.id, l.title, l.description, l.kind, l.approximate_area, c.source_label, c.expires_at
  from private.assisted_claims c join public.listings l on l.id = c.listing_id
  join public.profiles p on p.user_id = p_claimant_id
  join auth.users u on u.id = p_claimant_id
  where c.token_hash = p_token_hash and c.author_email_hmac = p_author_email_hmac
    and c.status = 'pending' and c.expires_at > now()
    and p.account_status = 'active' and p.deleted_at is null
    and u.email_confirmed_at is not null and nullif(u.email_change, '') is null;
end;
$$;

create function public.admin_resolve_assisted_claim(
  p_token_hash text, p_claimant_id uuid, p_author_email_hmac text, p_action text
)
returns table (listing_id uuid, terminal_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_claim private.assisted_claims%rowtype;
begin
  if p_action not in ('claim', 'reject') then
    raise exception using errcode = '23514', message = 'assisted action is invalid';
  end if;
  select * into v_claim from private.assisted_claims
  where token_hash = p_token_hash for update;
  if not found or v_claim.status <> 'pending' or v_claim.expires_at <= now()
    or v_claim.author_email_hmac <> p_author_email_hmac
    or not exists (
      select 1 from public.profiles p join auth.users u on u.id = p.user_id
      where p.user_id = p_claimant_id and p.account_status = 'active' and p.deleted_at is null
        and u.email_confirmed_at is not null and nullif(u.email_change, '') is null
    )
  then raise exception using errcode = '42501', message = 'assisted claim unavailable'; end if;

  if p_action = 'claim' then
    update private.assisted_claims set status = 'claimed', claimant_id = p_claimant_id,
      consumed_at = now(), updated_at = now() where id = v_claim.id;
    update public.listings set owner_id = p_claimant_id where id = v_claim.listing_id and status = 'draft';
    if not found then raise exception using errcode = '40001', message = 'assisted draft changed'; end if;
    return query select v_claim.listing_id, 'claimed'::text;
  else
    update private.assisted_claims set status = 'rejected', claimant_id = p_claimant_id,
      consumed_at = now(), updated_at = now() where id = v_claim.id;
    update public.listing_images set status = 'deleted', generation = gen_random_uuid(),
      derivative_path = null, content_digest = null, error_code = null
    where listing_id = v_claim.listing_id;
    delete from public.housing_details where listing_id = v_claim.listing_id;
    delete from public.item_details where listing_id = v_claim.listing_id;
    delete from public.listing_organizations where listing_id = v_claim.listing_id;
    update public.listings set title = 'Rejected assisted draft',
      description = 'The intended author rejected this assisted draft.',
      approximate_area = 'Removed', price_amount = 0, status = 'withdrawn',
      moderation_visible = false, deleted_at = now()
    where id = v_claim.listing_id and status = 'draft';
    return query select v_claim.listing_id, 'rejected'::text;
  end if;
end;
$$;

revoke execute on function public.admin_create_assisted_draft(uuid, uuid, uuid, text, text, text, timestamptz, public.listing_kind, uuid, uuid[], uuid, text, text, numeric, text, text, date, timestamptz, public.housing_subtype, boolean, boolean, boolean, boolean, boolean, public.item_condition, integer, text, boolean) from public, anon, authenticated;
revoke execute on function public.admin_inspect_assisted_claim(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_resolve_assisted_claim(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_create_assisted_draft(uuid, uuid, uuid, text, text, text, timestamptz, public.listing_kind, uuid, uuid[], uuid, text, text, numeric, text, text, date, timestamptz, public.housing_subtype, boolean, boolean, boolean, boolean, boolean, public.item_condition, integer, text, boolean) to service_role;
grant execute on function public.admin_inspect_assisted_claim(text, uuid, text) to service_role;
grant execute on function public.admin_resolve_assisted_claim(text, uuid, text, text) to service_role;
