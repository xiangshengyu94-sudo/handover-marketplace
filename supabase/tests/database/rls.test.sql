begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test');

insert into private.user_roles (user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'moderator');

insert into public.listings (
  id, owner_id, city_id, resource_category_id, kind, title, description,
  price_amount, currency, approximate_area, available_from, expires_at, status,
  moderation_visible, published_at
) values
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    'item', 'Public bicycle', 'A public bicycle visible to visitors before its expiry.',
    30, 'EUR', 'Benimaclet', current_date, now() + interval '7 days', 'active', true, now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004',
    'item', 'Private lamp draft', 'A draft that must remain visible only to its owner.',
    0, 'EUR', 'Benimaclet', current_date, now() + interval '7 days', 'draft', true, null
  );

insert into public.item_details (listing_id, condition, quantity, pickup_area, is_giveaway)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'good', 1, 'Benimaclet', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'fair', 1, 'Benimaclet', true);

set constraints all immediate;

set local role anon;
select results_eq(
  $$ select count(*)::bigint from public.listings $$,
  $$ values (1::bigint) $$,
  'anonymous users see only the public listing'
);
reset role;

select ok(
  not has_table_privilege('anon', 'public.listing_images', 'select'),
  'anonymous users cannot query private image metadata'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anonymous users cannot query profiles'
);

select ok(
  not has_table_privilege('authenticated', 'private.user_roles', 'select'),
  'authenticated users cannot query private roles'
);
select ok(
  has_table_privilege('service_role', 'private.user_roles', 'select'),
  'the server role can access private operational data'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.listings $$,
  $$ values (2::bigint) $$,
  'owner sees the public listing and their draft'
);
select ok(
  public.current_user_has_role('moderator'),
  'an assigned moderator can check their current protected role without reading the role table'
);
update public.listings
set title = 'Owner updated draft'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
reset role;
select is(
  (select title from public.listings where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  'Owner updated draft',
  'an active owner can update their own draft'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.listings $$,
  $$ values (1::bigint) $$,
  'another member cannot see the owner draft'
);
update public.listings set title = 'Tampered title' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
reset role;
select is(
  (select title from public.listings where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  'Owner updated draft',
  'a non-owner update cannot modify another listing'
);

update public.organizations
set status = 'retired'
where id = '20000000-0000-4000-8000-000000000001';
set local role anon;
select results_eq(
  $$ select name from public.organizations where id = '20000000-0000-4000-8000-000000000001' $$,
  $$ values ('MERCURI'::text) $$,
  'retired taxonomy remains historically readable'
);
reset role;

select * from finish();
rollback;
