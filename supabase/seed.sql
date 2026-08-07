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
