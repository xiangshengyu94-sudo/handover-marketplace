begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(34);

insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at) values
('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hardening-owner@example.test',now()),
('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hardening-sender@example.test',now()),
('91000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hardening-operator@example.test',now());
insert into private.user_roles(user_id,role) values
('91000000-0000-4000-8000-000000000003','operator');

insert into public.listings(
  id,owner_id,city_id,resource_category_id,kind,title,description,
  price_amount,currency,approximate_area,available_from,expires_at,status,published_at
) values (
  '92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',
  'item','Hardening delivery bicycle','A bicycle used to exercise deletion and delivery-state coordination.',
  55,'EUR','Ruzafa',current_date,now()+interval '30 days','active',now()
);
insert into public.item_details(listing_id,condition,quantity,pickup_area,is_giveaway)
values('92000000-0000-4000-8000-000000000001','good',1,'Ruzafa',false);
insert into public.listing_organizations(listing_id,organization_id)
values('92000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
insert into public.listing_images(
  id,listing_id,storage_path,derivative_path,content_digest,status,sort_order,
  original_media_type,byte_size,width,height
) values (
  '93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001',
  'hardening/original.webp','hardening/sanitized.webp',repeat('a',64),'ready',0,
  'image/webp',2048,1200,900
);

insert into private.contact_intents(
  id,sender_id,listing_id,request_key,token_hash,payload_hash,message_body,
  consented_at,expires_at,used_at,created_at
) values
('94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',repeat('1',64),repeat('a',64),'This delivered message must retain truthful provider status after deletion.',now(),now()+interval '10 minutes',now(),now()),
('94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002',repeat('2',64),repeat('b',64),'This future queued message must be cancelled before provider dispatch.',now(),now()+interval '10 minutes',now(),now()),
('94000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000003',repeat('3',64),repeat('c',64),'This leased message is revalidated immediately before provider dispatch.',now(),now()+interval '10 minutes',now(),now());
insert into private.contact_outbox(
  intent_id,sender_id,listing_id,message_body,payload_hash,status,idempotency_key,
  provider_email_id,available_at,created_at,updated_at
) values
('94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','This delivered message must retain truthful provider status after deletion.',repeat('a',64),'delivered','hardening/delivered','provider-delivered',now(),now(),now()),
('94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','This future queued message must be cancelled before provider dispatch.',repeat('b',64),'queued','hardening/queued',null,now()+interval '1 hour',now(),now()),
('94000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','This leased message is revalidated immediately before provider dispatch.',repeat('c',64),'queued','hardening/leased',null,now(),now()-interval '1 minute',now());

create temporary table hardening_export(payload jsonb) on commit drop;
insert into hardening_export
select public.admin_export_user_data(
  '91000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001'
);
select is((select payload#>>'{listings,0,city,name}' from hardening_export),'Valencia','export includes city context');
select is((select payload#>>'{listings,0,organizations,0,name}' from hardening_export),'MERCURI','export includes organization context');
select is((select payload#>>'{listings,0,item,condition}' from hardening_export),'good','export includes item subtype data');
select ok((select (payload#>'{listings,0,images,0}') ? 'mediaType' and not ((payload#>'{listings,0,images,0}') ? 'storagePath') from hardening_export),'export includes non-secret image metadata only');

create temporary table leased_contacts on commit drop as
select * from public.admin_lease_contact_outbox(1,'98000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from leased_contacts),1,'one eligible contact is leased');
select ok(public.admin_confirm_contact_dispatch(
  (select outbox_id from leased_contacts),'98000000-0000-4000-8000-000000000001'
),'eligible lease confirms before deletion');

select lives_ok($$ select public.admin_begin_account_deletion(
  '91000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000002',
  '97000000-0000-4000-8000-000000000002'
) $$,'account deletion coordinates communication and media');
select is((select status::text from private.contact_outbox where intent_id='94000000-0000-4000-8000-000000000001'),'delivered','delivered state is preserved');
select like((select message_body from private.contact_outbox where intent_id='94000000-0000-4000-8000-000000000001'),'[message removed%','delivered body is redacted independently');
select is((select status::text from private.contact_outbox where intent_id='94000000-0000-4000-8000-000000000002'),'failed','never-leased message is cancelled');
select is((select status::text from private.contact_outbox where intent_id='94000000-0000-4000-8000-000000000003'),'sending','active sending lease remains reconcilable');
select isnt(public.admin_confirm_contact_dispatch(
  (select outbox_id from leased_contacts),'98000000-0000-4000-8000-000000000001'
),true,'deleted owner fails immediate pre-send confirmation');
select is((select status::text from private.contact_outbox where intent_id='94000000-0000-4000-8000-000000000003'),'failed','failed confirmation reconciles the sending row');
select is((select count(*)::integer from private.storage_cleanup_outbox where bucket='listing-staging' and object_path='hardening/original.webp'),1,'image trigger durably queues staging cleanup');
select is((select count(*)::integer from private.storage_cleanup_outbox where bucket='listing-media' and object_path='hardening/sanitized.webp'),1,'image trigger durably queues derivative cleanup');
select ok((select title='Deleted listing' and description='This listing was removed after account deletion.' and approximate_area='Removed' from public.listings where id='92000000-0000-4000-8000-000000000001'),'account deletion anonymizes public listing text');
select ok((select listing.price_amount=0 and detail.is_giveaway and detail.quantity=1 and detail.pickup_area='Removed' from public.listings listing join public.item_details detail on detail.listing_id=listing.id where listing.id='92000000-0000-4000-8000-000000000001'),'account deletion preserves giveaway item invariants');
select is((select count(*)::integer from public.listing_organizations where listing_id='92000000-0000-4000-8000-000000000001'),0,'account deletion removes organization links');

insert into public.listings(
  id,owner_id,city_id,resource_category_id,kind,title,description,
  price_amount,currency,approximate_area,available_from,expires_at,source,status
) values
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','item','Expired assisted bicycle','This unclaimed assisted draft must be atomically tombstoned after expiry.',25,'EUR','Campanar',current_date,now()+interval '30 days','assisted','draft'),
('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','item','Pending assisted bicycle','This unclaimed assisted draft must remain impossible to publish.',35,'EUR','Campanar',current_date,now()+interval '30 days','assisted','draft');
insert into public.item_details(listing_id,condition,quantity,pickup_area,is_giveaway) values
('92000000-0000-4000-8000-000000000002','good',1,'Campanar',false),
('92000000-0000-4000-8000-000000000003','good',1,'Campanar',false);
insert into private.assisted_claims(
  id,listing_id,operator_id,token_hash,author_email_hmac,source_label,
  authorization_attested_at,status,expires_at,created_at,updated_at
) values
('99000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003',repeat('d',64),repeat('e',64),'Authorized source',now()-interval '2 days','pending',now()-interval '1 day',now()-interval '2 days',now()-interval '2 days'),
('99000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003',repeat('f',64),repeat('0',64),'Authorized source',now(),'pending',now()+interval '1 day',now(),now());
insert into public.listing_images(id,listing_id,storage_path,status,sort_order)
values('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','hardening/expired-assisted.webp','staged',0);

select lives_ok($$ select public.admin_run_retention(now()) $$,'retention atomically expires assisted drafts');
select is((select status::text from private.assisted_claims where id='99000000-0000-4000-8000-000000000001'),'expired','expired claim becomes terminal');
select ok((select status='withdrawn' and deleted_at is not null and moderation_visible is false from public.listings where id='92000000-0000-4000-8000-000000000002'),'expired assisted listing is tombstoned');
select is((select count(*)::integer from private.storage_cleanup_outbox where object_path='hardening/expired-assisted.webp'),1,'expired assisted media is queued for cleanup');
select throws_ok($$ update public.listings set status='active',published_at=now() where id='92000000-0000-4000-8000-000000000003' $$,'42501','assisted draft requires a completed owner claim','unclaimed assisted draft cannot publish');
select ok((select last_succeeded_at is null from private.job_state where job_name='retention'),'database phase does not claim external success');
select isnt(public.admin_finish_retention_run(
  (select last_started_at from private.job_state where job_name='retention'),
  '{"storageCleanup":{"completed":0}}'::jsonb
),true,'retention cannot finalize while provider cleanup is pending');
do $$
declare cleanup record;
begin
  if not public.admin_finish_privacy_request(
    '96000000-0000-4000-8000-000000000002','completed',null
  ) then
    raise exception 'privacy cleanup fixture could not be completed';
  end if;
  for cleanup in
    select * from public.admin_lease_storage_cleanup(
      100,'98000000-0000-4000-8000-000000000004'
    )
  loop
    if not public.admin_finish_storage_cleanup(
      cleanup.cleanup_id,'98000000-0000-4000-8000-000000000004',true,null
    ) then
      raise exception 'storage cleanup fixture lease was lost';
    end if;
  end loop;
end $$;
select ok(public.admin_finish_retention_run(
  (select last_started_at from private.job_state where job_name='retention'),
  '{"storageCleanup":"completed"}'::jsonb
),'caller records success only after external work');
select ok((select last_succeeded_at is not null from private.job_state where job_name='retention'),'retention success is finalized explicitly');

insert into private.privacy_requests(
  id,user_id,request_type,status,receipt_code,provider_cleanup,cleanup_attempts,
  cleanup_available_at,cleanup_lease_token,cleanup_leased_until
) values (
  '96000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002',
  'delete','partial','97000000-0000-4000-8000-000000000003',
  '{"authUserId":"91000000-0000-4000-8000-000000000002"}'::jsonb,9,now(),
  '98000000-0000-4000-8000-000000000002',now()+interval '5 minutes'
);
select ok(public.admin_finish_privacy_cleanup_retry(
  '96000000-0000-4000-8000-000000000003',
  '98000000-0000-4000-8000-000000000002',false,'provider-down'
),'tenth failed cleanup is recorded');
select is((select status from private.privacy_requests where id='96000000-0000-4000-8000-000000000003'),'failed','tenth failure becomes operator-visible failed state');
select ok((select provider_cleanup<>'{}'::jsonb from private.privacy_requests where id='96000000-0000-4000-8000-000000000003'),'failed cleanup retains retry payload');
select ok((select last_failed_at is not null from private.job_state where job_name='privacy-cleanup'),'privacy cleanup failure emits durable job signal');

insert into private.storage_cleanup_outbox(bucket,object_path)
values('listing-staging','hardening/provider-failure.webp');
create temporary table leased_storage on commit drop as
select * from public.admin_lease_storage_cleanup(100,'98000000-0000-4000-8000-000000000003');
select ok((select count(*)>0 from leased_storage),'durable Storage work can be leased');
select ok(public.admin_finish_storage_cleanup(
  (select min(cleanup_id) from leased_storage),
  '98000000-0000-4000-8000-000000000003',false,'provider-down'
),'failed Storage cleanup result is recorded');
select is((select status from private.storage_cleanup_outbox where id=(select min(cleanup_id) from leased_storage)),'retrying','failed Storage cleanup remains retryable');

select * from finish();
rollback;
