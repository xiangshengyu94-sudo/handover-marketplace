begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select has_table('public', 'cities', 'cities table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'resource_categories', 'resource categories table exists');
select has_table('public', 'listings', 'listings table exists');
select has_table('public', 'housing_details', 'housing details table exists');
select has_table('public', 'item_details', 'item details table exists');
select has_table('public', 'listing_organizations', 'listing organization join exists');
select col_type_is('public', 'cities', 'timezone', 'text', 'city timezone is stored explicitly');

select results_eq(
  $$ select name from public.cities where slug = 'valencia' $$,
  $$ values ('Valencia'::text) $$,
  'Valencia seed is available without becoming the only city'
);

select results_eq(
  $$ select count(*)::bigint from public.organizations where status = 'active' $$,
  $$ values (3::bigint) $$,
  'city-scoped and global organizations are seeded'
);

insert into auth.users (id, instance_id, aud, role, email)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'taxonomy-owner@example.test'
);

select throws_ok(
  $$
    insert into public.listings (
      id, owner_id, city_id, resource_category_id, kind, title, description,
      price_amount, currency, approximate_area, available_from, expires_at
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'item', 'Wrong subtype', 'A housing subtype cannot be attached to an item listing.',
      10, 'EUR', 'Benimaclet', current_date, now() + interval '7 days'
    )
  $$,
  '23503',
  null,
  'subtype-kind mismatch is rejected by the composite foreign key'
);

insert into public.listings (
  id, owner_id, city_id, resource_category_id, kind, title, description,
  price_amount, currency, approximate_area, available_from, expires_at
) values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  'item', 'Berlin bicycle', 'A valid bicycle listing used to verify organization compatibility.',
  25, 'EUR', 'Kreuzberg', current_date, now() + interval '7 days'
);

insert into public.item_details (listing_id, condition, quantity, pickup_area, is_giveaway)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'good', 1, 'Kreuzberg', false);

select throws_ok(
  $$
    insert into public.listing_organizations (listing_id, organization_id)
    values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  null,
  'a city-scoped organization from another city is rejected'
);

select * from finish();
rollback;
