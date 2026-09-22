begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'author@example.test', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9","role":"authenticated"}', true);

select lives_ok(
  $$ select * from public.save_own_listing(
    null, null, 'housing', '10000000-0000-4000-8000-000000000001', '{}'::uuid[],
    '30000000-0000-4000-8000-000000000001', 'Sunny room handover',
    'Furnished room near the university and a metro stop.', 520, 'EUR', 'Benimaclet',
    current_date + 1, now() + interval '30 days', 'room', true, true, true, true, true,
    null, null, null, null, false
  ) $$,
  'an active member can atomically save a housing draft'
);

select is(
  (select count(*)::integer from public.housing_details h join public.listings l on l.id = h.listing_id where l.owner_id = auth.uid()),
  1,
  'housing details are present for the housing listing'
);

select is(
  (select count(*)::integer from public.item_details d join public.listings l on l.id = d.listing_id where l.owner_id = auth.uid()),
  0,
  'inactive item details are absent'
);

select lives_ok(
  $$ select * from public.save_own_other_listing(
    null, null, '10000000-0000-4000-8000-000000000001', '{}'::uuid[],
    '30000000-0000-4000-8000-000000000007', 'Language exchange meetup',
    'A casual weekly meetup for newcomers who want to practise together.', 0,
    'EUR', 'City centre', current_date + 1, now() + interval '30 days', false
  ) $$,
  'an active member can atomically save a generic information draft'
);

select is(
  (
    select count(*)::integer
    from public.listings l
    left join public.housing_details h on h.listing_id = l.id
    left join public.item_details i on i.listing_id = l.id
    where l.owner_id = auth.uid() and l.kind = 'other'
      and h.listing_id is null and i.listing_id is null
  ),
  1,
  'generic information listings have no housing or item detail row'
);

select throws_ok(
  $$ insert into public.listings (owner_id, city_id, resource_category_id, kind, title, description, price_amount, currency, approximate_area, available_from, expires_at)
     values (auth.uid(), '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'item', 'Direct write', 'This direct write must never be accepted by the database.', 10, 'EUR', 'Center', current_date, now() + interval '1 day') $$,
  '42501', null, 'direct listing inserts are denied'
);

select throws_ok(
  $$ select * from public.save_own_listing(
    null, null, 'item', '10000000-0000-4000-8000-000000000001', '{}'::uuid[],
    '30000000-0000-4000-8000-000000000003', 'Bicycle with phone',
    'Contact me at +34 612 345 678 to collect the bicycle.', 30, 'EUR', 'Ruzafa',
    current_date + 1, now() + interval '30 days', null, null, null, null, null, null,
    'good', 1, 'Ruzafa', false, false
  ) $$,
  '23514', null, 'unsafe public contact data is rejected in the database'
);

select lives_ok(
  format(
    'select * from public.stage_own_listing_image(%L, 0, %L, 1024)',
    (select id from public.listings where owner_id = auth.uid() limit 1),
    'image/jpeg'
  ),
  'an owner can reserve a bounded staging path for a saved draft'
);

select * from finish();
rollback;
