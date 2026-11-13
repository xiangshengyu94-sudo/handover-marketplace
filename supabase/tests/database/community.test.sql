begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaacc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'community-author@example.test', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaacc","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.community_posts (author_id, city_id, type, title, body)
     values (auth.uid(), '10000000-0000-4000-8000-000000000001', 'question', 'Where can I repair my bike?', 'I have just arrived and need a reliable repair shop in this city.') $$,
  'active member can publish a question'
);

select lives_ok(
  $$ insert into public.community_answers (question_id, author_id, body)
     select id, auth.uid(), 'I used a small workshop near the centre and it was helpful.'
     from public.community_posts where title = 'Where can I repair my bike?' $$,
  'member can answer a published question'
);

select lives_ok(
  $$ insert into public.community_posts (author_id, city_id, type, title, body, related_question_id)
     select auth.uid(), city_id, 'experience', 'My bike repair experience',
       'I compared local repair options and found a workshop that worked well.', id
     from public.community_posts where title = 'Where can I repair my bike?' $$,
  'independent experience can link to a question'
);

select is(
  (select count(*)::integer from public.community_answers a join public.community_posts q on q.id = a.question_id where q.title = 'Where can I repair my bike?'),
  1,
  'answer remains under the original question'
);

select is(
  (select count(*)::integer from public.community_posts e join public.community_posts q on q.id = e.related_question_id where e.type = 'experience' and q.type = 'question'),
  1,
  'related experience points to a question'
);

select throws_ok(
  $$ insert into public.community_posts (author_id, city_id, type, title, body, related_question_id)
     select auth.uid(), city_id, 'question', 'Another linked question',
       'A question must not masquerade as an experience linked to another question.', id
     from public.community_posts where title = 'Where can I repair my bike?' $$,
  '23514', null, 'question cannot link to another question'
);

select throws_ok(
  $$ insert into public.community_answers (question_id, author_id, body)
     select id, auth.uid(), 'An experience is not an answerable question here.'
     from public.community_posts where title = 'My bike repair experience' $$,
  '23514', null, 'answers can only belong to questions'
);

select throws_ok(
  $$ insert into public.community_answers (question_id, author_id, body)
     select id, auth.uid(), 'Email me at private@example.com for the full answer.'
     from public.community_posts where title = 'Where can I repair my bike?' $$,
  '23514', null, 'public answers reject private contact details'
);

reset role;
insert into auth.users (id, instance_id, aud, role, email)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unverified-community@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.community_posts (author_id, city_id, type, title, body)
     values (auth.uid(), '10000000-0000-4000-8000-000000000001', 'question', 'Unverified user question', 'An unverified address must not publish a question here.') $$,
  '42501', null, 'unverified email cannot publish directly through the database'
);

set local role anon;
select is(
  (select count(*)::integer from public.community_posts where type = 'question'),
  1,
  'anonymous visitors can read published questions'
);

reset role;
update public.profiles set account_status = 'deleted', deleted_at = now()
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaacc';

select is(
  (select count(*)::integer from public.community_posts where author_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaacc' and moderation_visible = false and body = 'This post was removed after account deletion.'),
  2,
  'account deletion removes authored posts from public view and scrubs their text'
);
select is(
  (select count(*)::integer from public.community_answers where author_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaacc' and moderation_visible = false and body = 'This answer was removed after account deletion.'),
  1,
  'account deletion removes authored answers from public view and scrubs their text'
);

select * from finish();
rollback;
