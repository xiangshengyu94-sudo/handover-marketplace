begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@example.test', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'author@example.test', now());
insert into private.user_roles (user_id, role) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'operator');

select lives_ok(
  $$ select public.admin_create_assisted_draft(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', repeat('a',64), repeat('b',64),
    'Valencia exchange group', now() + interval '14 days', 'item',
    '10000000-0000-4000-8000-000000000001', '{}'::uuid[], '30000000-0000-4000-8000-000000000003',
    'Assisted bicycle draft', 'A private bicycle draft awaiting review by the invited author.',
    40, 'EUR', 'Ruzafa', current_date + 1, now() + interval '30 days',
    null, null, null, null, null, null, 'good', 1, 'Ruzafa', false
  ) $$,
  'authorized operator can create a private assisted draft'
);

set local role anon;
select is((select count(*)::integer from public.listings where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'), 0, 'assisted draft is absent from public discovery');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated"}', true);
select throws_ok(
  $$ select * from public.save_own_listing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 1, 'item', '10000000-0000-4000-8000-000000000001', '{}'::uuid[],
    '30000000-0000-4000-8000-000000000003', 'Assisted bicycle draft', 'A private bicycle draft awaiting review by the invited author.',
    40, 'EUR', 'Ruzafa', current_date + 1, now() + interval '30 days', null, null, null, null, null, null,
    'good', 1, 'Ruzafa', false, true
  ) $$,
  '42501', null, 'operator cannot publish before author claim'
);
reset role;

select is((select count(*)::integer from public.admin_inspect_assisted_claim(repeat('a',64), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', repeat('b',64))), 1, 'matching verified author can privately inspect');
select is((select count(*)::integer from public.admin_inspect_assisted_claim(repeat('a',64), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', repeat('c',64))), 0, 'different email HMAC reveals no preview');

select lives_ok(
  $$ select * from public.admin_resolve_assisted_claim(repeat('a',64), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', repeat('b',64), 'claim') $$,
  'matching author can atomically claim'
);
select is((select owner_id from public.listings where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid, 'claim transfers ownership');
select is((select status::text from private.assisted_claims where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'), 'claimed', 'claim token becomes terminal');
select throws_ok(
  $$ select * from public.admin_resolve_assisted_claim(repeat('a',64), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', repeat('b',64), 'claim') $$,
  '42501', null, 'used claim token cannot be replayed'
);
select is((select count(*)::integer from private.assisted_claims where author_email_hmac = repeat('b',64)), 1, 'only an HMAC, not the author email, remains in claim evidence');

select * from finish();
rollback;
