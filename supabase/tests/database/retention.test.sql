begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id,instance_id,aud,role,email,email_confirmed_at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retention-owner@example.test',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retention-sender@example.test',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retention-admin@example.test',now());
insert into private.user_roles(user_id,role) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3','administrator');

insert into public.listings(id,owner_id,city_id,resource_category_id,kind,title,description,price_amount,currency,approximate_area,available_from,expires_at,status,published_at)
values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','item','Expired retention bicycle','A bicycle whose exclusive expiry boundary is exercised by the retention job.',30,'EUR','Ruzafa',current_date,now()-interval '1 second','active',now()-interval '10 days'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','item','Deletion retention bicycle','A public bicycle that must disappear before external account cleanup begins.',40,'EUR','Benimaclet',current_date,now()+interval '10 days','active',now());
insert into public.item_details(listing_id,condition,quantity,pickup_area,is_giveaway) values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1','good',1,'Ruzafa',false),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2','good',1,'Benimaclet',false);

insert into private.contact_intents(id,sender_id,listing_id,request_key,token_hash,payload_hash,message_body,consented_at,expires_at,used_at,created_at)
values('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',repeat('a',64),repeat('b',64),'This old message should be removed after the documented retention period.',now()-interval '40 days',now()-interval '39 days',now()-interval '40 days',now()-interval '40 days');
insert into private.contact_outbox(intent_id,sender_id,listing_id,message_body,payload_hash,status,idempotency_key,created_at,updated_at)
values('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1','This old message should be removed after the documented retention period.',repeat('b',64),'delivered','retention-old-message',now()-interval '40 days',now()-interval '40 days');

set local role anon;
select is((select count(*)::integer from public.listings where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1'),0,'query-time expiry hides a stale active row before cron');
reset role;
select lives_ok($$ select public.admin_run_retention(now()) $$,'retention job succeeds');
select is((select status::text from public.listings where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1'),'expired','retention materializes expiry');
select is((public.admin_run_retention(now())->>'expiredListings')::integer,0,'second retention pass is idempotent');
select ok((select body_purged_at is not null and message_body like '[message purged%' from private.contact_outbox where intent_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),'old contact body is purged');

select lives_ok($$ select public.admin_begin_account_deletion('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','ffffffff-ffff-4fff-8fff-fffffffffff1') $$,'account deletion begins atomically');
set local role anon;
select is((select count(*)::integer from public.listings where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),0,'account listings disappear before provider cleanup');
reset role;
select is((select account_status from public.profiles where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'),'deleted','profile is tombstoned');
select ok((select provider_cleanup ? 'authUserId' from private.privacy_requests where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'provider retry work is durable');
select throws_ok($$ select public.admin_begin_account_deletion('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','ffffffff-ffff-4fff-8fff-fffffffffff2') $$,'23514','last administrator cannot delete account','last administrator deletion is blocked');

select * from finish();
rollback;
