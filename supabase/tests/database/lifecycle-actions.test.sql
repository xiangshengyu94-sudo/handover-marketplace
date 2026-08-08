begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle@example.test', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8","role":"authenticated"}', true);

select lives_ok(
  $$ select * from public.save_own_listing(
    null, null, 'item', '10000000-0000-4000-8000-000000000001', '{}'::uuid[],
    '30000000-0000-4000-8000-000000000003', 'Lifecycle test bicycle',
    'A bicycle used to prove guarded lifecycle transitions.', 30, 'EUR', 'Ruzafa',
    current_date, now() + interval '30 days', null, null, null, null, null, null,
    'good', 1, 'Ruzafa', false, true
  ) $$,
  'owner can publish the lifecycle fixture'
);

select ok((select public.listing_is_contactable(status, moderation_visible, expires_at, deleted_at) from public.listings where owner_id = auth.uid()), 'active fixture is contactable');

select lives_ok(
  format('select * from public.transition_own_listing(%L, 1, %L, null)', (select id from public.listings where owner_id = auth.uid()), 'reserve'),
  'owner can reserve the active listing'
);

select ok(not (select public.listing_is_contactable(status, moderation_visible, expires_at, deleted_at) from public.listings where owner_id = auth.uid()), 'reserved listing is not contactable');

select throws_ok(
  format('select * from public.transition_own_listing(%L, 1, %L, null)', (select id from public.listings where owner_id = auth.uid()), 'reopen'),
  '40001', null, 'a stale lifecycle version is rejected'
);

select lives_ok(
  format('select * from public.transition_own_listing(%L, 2, %L, null)', (select id from public.listings where owner_id = auth.uid()), 'reopen'),
  'owner can reopen the reserved listing with the current version'
);

reset role;
select is((select count(*)::integer from private.cache_invalidation_outbox where aggregate_id = (select id from public.listings where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8')), 2, 'every committed transition records durable cache work');

select * from finish();
rollback;
