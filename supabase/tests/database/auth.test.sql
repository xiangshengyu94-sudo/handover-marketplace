begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select has_table('private', 'auth_intents', 'auth intents are server-side state');
select has_table('private', 'rate_limit_buckets', 'rate limits are server-side state');
select has_table('private', 'captcha_challenges', 'CAPTCHA replay state is private');
select ok(
  not has_table_privilege('anon', 'private.auth_intents', 'select'),
  'anonymous users cannot read authentication intents'
);
select ok(
  not has_table_privilege('authenticated', 'private.rate_limit_buckets', 'select'),
  'members cannot read rate-limit identifiers'
);
select ok(
  has_table_privilege('service_role', 'private.auth_intents', 'select'),
  'service role can operate authentication intents'
);
select ok(
  not has_function_privilege('anon', 'public.admin_find_auth_intent(text)', 'execute'),
  'anonymous users cannot call auth-intent RPCs'
);
select ok(
  has_function_privilege('service_role', 'public.admin_find_auth_intent(text)', 'execute'),
  'service role can call auth-intent RPCs'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'confirmed@example.test', now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
select ok(public.current_user_is_active(), 'a confirmed active account can mutate');
reset role;

update auth.users
set email_change = 'new@example.test', email_change_sent_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
select ok(
  not public.current_user_is_active(),
  'a pending email change pauses member mutations'
);
reset role;

select public.admin_create_auth_intent(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  repeat('1', 64), repeat('2', 64), 'login', '/account', now(), now() + interval '10 minutes'
);
select is(
  (select count(*)::integer from public.admin_find_auth_intent(repeat('1', 64))),
  1,
  'a service intent can be found by its one-way nonce hash'
);
select ok(
  public.admin_consume_auth_intent('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', now()),
  'an active intent is consumed once'
);
select ok(
  not public.admin_consume_auth_intent('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', now()),
  'a consumed intent cannot be replayed'
);

select * from finish();
rollback;
