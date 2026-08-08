begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contact-owner@example.test', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'contact-sender@example.test', now());

insert into public.listings (id, owner_id, city_id, resource_category_id, kind, title, description, price_amount, currency, approximate_area, available_from, expires_at, status, published_at)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'item', 'Contact relay bicycle', 'A public bicycle used to prove private contact relay behavior.', 30, 'EUR', 'Ruzafa', current_date, now() + interval '30 days', 'active', now());
insert into public.item_details (listing_id, condition, quantity, pickup_area, is_giveaway)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', 'good', 1, 'Ruzafa', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7","role":"authenticated"}', true);

select lives_ok(
  $$ select * from public.issue_contact_intent('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', repeat('a', 64), repeat('b', 64), 'I arrive next week and would like to collect this bicycle.', now() + interval '10 minutes') $$,
  'sender can issue a bound short-lived intent'
);
select lives_ok(
  $$ select * from public.issue_contact_intent('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', repeat('a', 64), repeat('b', 64), 'I arrive next week and would like to collect this bicycle.', now() + interval '9 minutes') $$,
  'a request-key retry reuses the existing intent'
);
select is((select count(*)::integer from private.contact_intents), 1, 'request-key retry does not add an intent');

select lives_ok(
  $$ select * from public.consume_contact_intent(repeat('a', 64), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', repeat('b', 64), 'I arrive next week and would like to collect this bicycle.') $$,
  'a matching intent queues contact'
);
select lives_ok(
  $$ select * from public.consume_contact_intent(repeat('a', 64), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', repeat('b', 64), 'I arrive next week and would like to collect this bicycle.') $$,
  'a network retry returns the existing queue state'
);
select is((select count(*)::integer from private.contact_outbox), 1, 'contact retry never duplicates the outbox row');
select is((select idempotency_key from private.contact_outbox), 'contact/cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'provider idempotency is stable for the accepted intent');

reset role;
update public.listings set status = 'reserved' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7","role":"authenticated"}', true);
select throws_ok(
  $$ select * from public.issue_contact_intent('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', repeat('c', 64), repeat('d', 64), 'This reserved listing must not accept a new contact intent.', now() + interval '10 minutes') $$,
  '42501', null, 'reserved listings block new contact intents'
);

select * from finish();
rollback;
