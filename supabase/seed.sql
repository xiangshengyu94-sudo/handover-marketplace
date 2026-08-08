insert into public.cities (id, slug, name, country_code, timezone, status)
values
  ('10000000-0000-4000-8000-000000000001', 'valencia', 'Valencia', 'ES', 'Europe/Madrid', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'berlin', 'Berlin', 'DE', 'Europe/Berlin', 'active')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  country_code = excluded.country_code,
  timezone = excluded.timezone,
  status = excluded.status;

insert into public.organizations (id, city_id, slug, name, status)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'mercuri', 'MERCURI', 'active'),
  ('20000000-0000-4000-8000-000000000002', null, 'erasmus-community', 'Erasmus community', 'active'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'tu-berlin-international', 'TU Berlin International', 'active')
on conflict (id) do update set
  city_id = excluded.city_id,
  slug = excluded.slug,
  name = excluded.name,
  status = excluded.status;

insert into public.resource_categories (id, kind, slug, label, status)
values
  ('30000000-0000-4000-8000-000000000001', 'housing', 'room', 'Room', 'active'),
  ('30000000-0000-4000-8000-000000000002', 'housing', 'studio', 'Studio', 'active'),
  ('30000000-0000-4000-8000-000000000003', 'item', 'bicycle', 'Bicycle', 'active'),
  ('30000000-0000-4000-8000-000000000004', 'item', 'furniture', 'Furniture', 'active'),
  ('30000000-0000-4000-8000-000000000005', 'item', 'household', 'Household item', 'active'),
  ('30000000-0000-4000-8000-000000000006', 'item', 'electronics', 'Electronics', 'active')
on conflict (id) do update set
  kind = excluded.kind,
  slug = excluded.slug,
  label = excluded.label,
  status = excluded.status;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'seed-owner@example.test', now()
)
on conflict (id) do nothing;

insert into public.listings (
  id, owner_id, city_id, resource_category_id, kind, title, description,
  price_amount, currency, approximate_area, available_from, expires_at,
  status, moderation_visible, published_at
) values
  (
    '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    'housing', 'Sunny furnished room in Benimaclet',
    'A bright furnished room near public transport, available for the next exchange term.',
    520, 'EUR', 'Benimaclet', current_date + 7, now() + interval '90 days',
    'active', true, now()
  ),
  (
    '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003',
    'item', 'Reliable city bicycle with lock',
    'A practical bicycle for daily commutes, recently serviced and ready for collection.',
    85, 'EUR', 'Ruzafa', current_date, now() + interval '45 days',
    'active', true, now()
  ),
  (
    '50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004',
    'item', 'Free desk and reading lamp',
    'A sturdy study desk with a small lamp, free for someone who can collect both together.',
    0, 'EUR', 'Neukölln', current_date + 2, now() + interval '60 days',
    'reserved', true, now()
  )
on conflict (id) do update set expires_at = excluded.expires_at;

insert into public.housing_details (
  listing_id, subtype, furnished, bills_included,
  publication_rights_acknowledged, permission_acknowledged, safety_warning_acknowledged
) values ('50000000-0000-4000-8000-000000000001', 'room', true, true, true, true, true)
on conflict (listing_id) do nothing;

insert into public.item_details (listing_id, condition, quantity, pickup_area, is_giveaway)
values
  ('50000000-0000-4000-8000-000000000002', 'good', 1, 'Ruzafa', false),
  ('50000000-0000-4000-8000-000000000003', 'good', 2, 'Neukölln', true)
on conflict (listing_id) do nothing;

insert into public.listing_organizations (listing_id, organization_id)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003')
on conflict do nothing;
