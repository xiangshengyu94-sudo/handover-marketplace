begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id,instance_id,aud,role,email,email_confirmed_at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reported-owner@example.test',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reporter@example.test',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','moderator@example.test',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','administrator@example.test',now());
insert into private.user_roles(user_id,role) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','moderator'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','administrator');
insert into public.listings(id,owner_id,city_id,resource_category_id,kind,title,description,price_amount,currency,approximate_area,available_from,expires_at,status,published_at)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','item','Reported bicycle listing','A public bicycle listing used for moderation transaction tests.',30,'EUR','Ruzafa',current_date,now()+interval '30 days','active',now());
insert into public.item_details(listing_id,condition,quantity,pickup_area,is_giveaway) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','good',1,'Ruzafa',false);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","role":"authenticated"}',true);
select lives_ok($$ select public.submit_member_report('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','privacy','This listing appears to expose private personal information in a public field.') $$,'member can submit report');
reset role;
select ok((select urgent from private.member_reports limit 1),'privacy report enters urgent queue');
select lives_ok($$ select public.admin_moderate_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','hide','Private information requires immediate review',(select id from private.member_reports limit 1)) $$,'moderator can hide atomically');
set local role anon;
select is((select count(*)::integer from public.listings where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),0,'hidden listing immediately disappears publicly');
reset role;
select is((select count(*)::integer from private.moderation_history),1,'hide appends history');
select is((select count(*)::integer from private.notification_outbox),1,'hide queues owner notification');
select is((select count(*)::integer from private.cache_invalidation_outbox where aggregate_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),1,'hide queues cache invalidation');
select lives_ok($$ select public.admin_moderate_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','restore','Review completed and listing may return',null) $$,'administrator can restore');
select is((select count(*)::integer from private.moderation_history),2,'restore appends rather than overwrites history');
select throws_ok($$ update private.moderation_history set reason='tampered history' $$,'42501',null,'moderation history cannot be rewritten');
select throws_ok($$ select public.admin_manage_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','moderator','grant') $$,'42501',null,'administrator cannot self-grant');

select * from finish();
rollback;
