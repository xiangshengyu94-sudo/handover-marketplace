create schema private;
revoke all on schema private from public, anon, authenticated;

create type private.app_role as enum ('operator', 'moderator', 'administrator');

create table private.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role private.app_role not null,
  granted_by uuid references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role),
  check (revoked_at is null or revoked_at >= granted_at)
);

alter table private.user_roles enable row level security;
alter table private.user_roles force row level security;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and account_status = 'active'
      and deleted_at is null
  );
$$;

create function public.current_user_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private, auth
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = auth.uid()
      and role::text = p_role
      and revoked_at is null
  );
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.cities enable row level security;
alter table public.cities force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.resource_categories enable row level security;
alter table public.resource_categories force row level security;
alter table public.listings enable row level security;
alter table public.listings force row level security;
alter table public.listing_organizations enable row level security;
alter table public.listing_organizations force row level security;
alter table public.housing_details enable row level security;
alter table public.housing_details force row level security;
alter table public.item_details enable row level security;
alter table public.item_details force row level security;
alter table public.listing_images enable row level security;
alter table public.listing_images force row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy cities_readable
on public.cities for select to anon, authenticated
using (true);
create policy organizations_readable
on public.organizations for select to anon, authenticated
using (true);
create policy resource_categories_readable
on public.resource_categories for select to anon, authenticated
using (true);

create policy listings_public_select
on public.listings for select to anon
using (
  public.listing_is_public(status, moderation_visible, expires_at, deleted_at)
);
create policy listings_member_select
on public.listings for select to authenticated
using (
  owner_id = auth.uid()
  or public.listing_is_public(status, moderation_visible, expires_at, deleted_at)
);
create policy listings_owner_insert
on public.listings for insert to authenticated
with check (owner_id = auth.uid() and public.current_user_is_active());
create policy listings_owner_update
on public.listings for update to authenticated
using (owner_id = auth.uid() and public.current_user_is_active())
with check (owner_id = auth.uid() and public.current_user_is_active());
create policy listings_owner_delete
on public.listings for delete to authenticated
using (owner_id = auth.uid() and public.current_user_is_active());

create policy listing_organizations_public_select
on public.listing_organizations for select to anon
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
  )
);
create policy listing_organizations_member_select
on public.listing_organizations for select to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (
        l.owner_id = auth.uid()
        or public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
      )
  )
);
create policy listing_organizations_owner_insert
on public.listing_organizations for insert to authenticated
with check (
  public.current_user_is_active()
  and exists (
    select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()
  )
);
create policy listing_organizations_owner_delete
on public.listing_organizations for delete to authenticated
using (
  public.current_user_is_active()
  and exists (
    select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()
  )
);

create policy housing_details_public_select
on public.housing_details for select to anon
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
  )
);
create policy housing_details_member_select
on public.housing_details for select to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (
        l.owner_id = auth.uid()
        or public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
      )
  )
);
create policy housing_details_owner_insert
on public.housing_details for insert to authenticated
with check (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy housing_details_owner_update
on public.housing_details for update to authenticated
using (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
)
with check (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy housing_details_owner_delete
on public.housing_details for delete to authenticated
using (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy item_details_public_select
on public.item_details for select to anon
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
  )
);
create policy item_details_member_select
on public.item_details for select to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (
        l.owner_id = auth.uid()
        or public.listing_is_public(l.status, l.moderation_visible, l.expires_at, l.deleted_at)
      )
  )
);
create policy item_details_owner_insert
on public.item_details for insert to authenticated
with check (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy item_details_owner_update
on public.item_details for update to authenticated
using (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
)
with check (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy item_details_owner_delete
on public.item_details for delete to authenticated
using (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy listing_images_owner_select
on public.listing_images for select to authenticated
using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy listing_images_owner_insert
on public.listing_images for insert to authenticated
with check (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy listing_images_owner_delete
on public.listing_images for delete to authenticated
using (
  public.current_user_is_active()
  and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.cities, public.organizations, public.resource_categories,
  public.listings, public.listing_organizations, public.housing_details,
  public.item_details to anon, authenticated;
grant select on public.profiles, public.listing_images to authenticated;

grant insert (
  owner_id, city_id, resource_category_id, kind, title, description,
  price_amount, currency, approximate_area, available_from, expires_at,
  source, status
) on public.listings to authenticated;
grant update (
  city_id, resource_category_id, kind, title, description, price_amount,
  currency, approximate_area, available_from, expires_at, status
) on public.listings to authenticated;
grant delete on public.listings to authenticated;

grant insert, update, delete on public.housing_details, public.item_details to authenticated;
grant insert, delete on public.listing_organizations to authenticated;
grant insert (listing_id, storage_path, sort_order)
  on public.listing_images to authenticated;
grant delete on public.listing_images to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.listing_is_public(
  public.listing_status, boolean, timestamptz, timestamptz, timestamptz
) to anon, authenticated;
grant execute on function public.listing_is_contactable(
  public.listing_status, boolean, timestamptz, timestamptz, timestamptz
) to authenticated;
grant execute on function public.listing_transition_allowed(
  public.listing_status, public.listing_status
) to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_has_role(text) to authenticated;

grant usage on schema public, private to service_role;
grant all on all tables in schema public, private to service_role;
grant execute on all functions in schema public, private to service_role;

revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema private grant all on tables to service_role;
alter default privileges in schema private grant execute on functions to service_role;

comment on schema private is
  'Server-only operational data. This schema must never be added to the exposed PostgREST schemas.';
