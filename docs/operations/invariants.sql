-- Run as the production database owner before migration, after migration, at
-- cutover, and during each observation checkpoint. Every observed_violations
-- value must be zero. Preserve the complete result with project ID and UTC time.

with public_api_tables(table_name) as (
  values ('profiles'),('cities'),('organizations'),('resource_categories'),
    ('listings'),('listing_organizations'),('housing_details'),('item_details'),
    ('listing_images')
)
select 'public_table_without_forced_rls' as invariant,
  count(*)::bigint as observed_violations
from public_api_tables expected
left join pg_class c on c.relname=expected.table_name
left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.oid is null or not c.relrowsecurity or not c.relforcerowsecurity
union all
select 'private_table_granted_to_public_roles',count(*)::bigint
from information_schema.role_table_grants
where table_schema='private' and grantee in ('PUBLIC','anon','authenticated')
union all
select 'admin_function_executable_by_public_roles',count(*)::bigint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'admin\_%' escape '\'
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
union all
select 'listing_without_exactly_one_kind_detail',count(*)::bigint
from public.listings l
left join public.housing_details h on h.listing_id=l.id
left join public.item_details i on i.listing_id=l.id
where (l.kind='housing' and (h.listing_id is null or i.listing_id is not null))
   or (l.kind='item' and (i.listing_id is null or h.listing_id is not null))
union all
select 'listing_category_kind_mismatch',count(*)::bigint
from public.listings l join public.resource_categories c on c.id=l.resource_category_id
where l.kind<>c.kind
union all
select 'public_listing_with_inactive_context',count(distinct l.id)::bigint
from public.listings l
join public.cities c on c.id=l.city_id
join public.resource_categories rc on rc.id=l.resource_category_id
left join public.listing_organizations lo on lo.listing_id=l.id
left join public.organizations o on o.id=lo.organization_id
where public.listing_is_public(l.status,l.moderation_visible,l.expires_at,l.deleted_at)
  and (c.status<>'active' or rc.status<>'active' or (o.id is not null and o.status<>'active'))
union all
select 'materialized_expiry_lag',count(*)::bigint
from public.listings
where status in ('active','reserved') and expires_at<=now() and deleted_at is null
union all
select 'invalid_ready_image_on_public_listing',count(*)::bigint
from public.listing_images i join public.listings l on l.id=i.listing_id
where public.listing_is_public(l.status,l.moderation_visible,l.expires_at,l.deleted_at)
  and i.status='ready' and (i.derivative_path is null or i.derivative_path=i.storage_path)
union all
select 'duplicate_contact_intent_or_idempotency_key',
  ((select count(*)-count(distinct intent_id) from private.contact_outbox)
   +(select count(*)-count(distinct idempotency_key) from private.contact_outbox))::bigint
union all
select 'moderation_append_only_trigger_missing',
  case when exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='moderation_history'
      and t.tgname='moderation_history_append_only' and t.tgenabled<>'D'
  ) then 0::bigint else 1::bigint end
union all
select 'public_image_for_deleted_or_ineligible_listing',count(*)::bigint
from public.listing_images i join public.listings l on l.id=i.listing_id
where i.status='ready' and i.derivative_path is not null
  and l.deleted_at is not null;
