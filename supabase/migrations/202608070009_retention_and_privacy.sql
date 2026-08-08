create table private.privacy_requests (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  request_type text not null check (request_type in ('export','delete')),
  status text not null check (status in ('processing','completed','partial','failed')),
  receipt_code uuid not null unique,
  error_code text,
  provider_cleanup jsonb not null default '{}'::jsonb,
  cleanup_attempts integer not null default 0 check (cleanup_attempts between 0 and 10),
  cleanup_available_at timestamptz not null default now(),
  cleanup_lease_token uuid,
  cleanup_leased_until timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((cleanup_lease_token is null) = (cleanup_leased_until is null))
);

create table private.job_state (
  job_name text primary key,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  consecutive_failures integer not null default 0,
  last_result jsonb not null default '{}'::jsonb
);

create table private.storage_cleanup_outbox (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('listing-staging','listing-media')),
  object_path text not null check (
    object_path <> '' and object_path !~ '(^|/)\.\.(/|$)'
  ),
  source_image_id uuid references public.listing_images (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','leased','retrying','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bucket,object_path),
  check ((lease_token is null) = (leased_until is null)),
  check ((status = 'leased') = (lease_token is not null))
);

create index privacy_requests_cleanup_idx
  on private.privacy_requests (cleanup_available_at,id)
  where request_type='delete' and status='partial' and cleanup_attempts<10;
create index listings_retention_expiry_idx
  on public.listings (expires_at,id)
  where status in ('active','reserved') and deleted_at is null;
create index contact_outbox_body_retention_idx
  on private.contact_outbox (created_at,id) where body_purged_at is null;
create index contact_intents_retention_idx on private.contact_intents (created_at,id);
create index assisted_claims_retention_idx
  on private.assisted_claims (expires_at,id) where status='pending';
create index listing_images_retention_idx
  on public.listing_images (updated_at,id)
  where status in ('staged','processing','failed');
create index captcha_challenges_retention_idx on private.captcha_challenges (expires_at);
create index rate_limit_buckets_retention_idx on private.rate_limit_buckets (window_started_at);
create index storage_cleanup_dispatch_idx
  on private.storage_cleanup_outbox (available_at,id)
  where status in ('queued','retrying','leased') and attempts<10;

alter table private.privacy_requests enable row level security;
alter table private.privacy_requests force row level security;
alter table private.job_state enable row level security;
alter table private.job_state force row level security;
alter table private.storage_cleanup_outbox enable row level security;
alter table private.storage_cleanup_outbox force row level security;
revoke all on private.privacy_requests, private.job_state,
  private.storage_cleanup_outbox from public,anon,authenticated;
grant all on private.privacy_requests, private.job_state,
  private.storage_cleanup_outbox to service_role;

create function private.enqueue_listing_image_cleanup()
returns trigger language plpgsql security definer
set search_path = pg_catalog, private as $$
begin
  if old.status <> 'deleted' and new.status = 'deleted' then
    insert into private.storage_cleanup_outbox(bucket,object_path,source_image_id)
    values ('listing-staging',old.storage_path,old.id)
    on conflict(bucket,object_path) do nothing;
    if old.derivative_path is not null then
      insert into private.storage_cleanup_outbox(bucket,object_path,source_image_id)
      values ('listing-media',old.derivative_path,old.id)
      on conflict(bucket,object_path) do nothing;
    end if;
  end if;
  return new;
end; $$;

create trigger listing_images_enqueue_storage_cleanup
after update of status on public.listing_images
for each row execute function private.enqueue_listing_image_cleanup();

-- Older deleted rows no longer retain derivative paths, but their original
-- staging paths are still known and safe to retry idempotently.
insert into private.storage_cleanup_outbox(bucket,object_path,source_image_id)
select 'listing-staging',storage_path,id from public.listing_images
where status='deleted'
on conflict(bucket,object_path) do nothing;

create function public.admin_export_user_data(p_user_id uuid,p_request_id uuid,p_receipt_code uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, auth as $$
declare v_export jsonb; begin
  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.user_id
    where p.user_id=p_user_id and p.account_status='active' and p.deleted_at is null and u.email_confirmed_at is not null)
  then raise exception using errcode='42501',message='export unavailable'; end if;
  insert into private.privacy_requests(id,user_id,request_type,status,receipt_code)
  values(p_request_id,p_user_id,'export','processing',p_receipt_code);
  select jsonb_build_object(
    'receipt',p_receipt_code,'generatedAt',now(),
    'account',(select jsonb_build_object('userId',u.id,'email',u.email,'displayName',p.display_name,'createdAt',p.created_at) from auth.users u join public.profiles p on p.user_id=u.id where u.id=p_user_id),
    'listings',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',l.id,
        'kind',l.kind,
        'title',l.title,
        'description',l.description,
        'status',l.status,
        'price',l.price_amount,
        'currency',l.currency,
        'area',l.approximate_area,
        'availableFrom',l.available_from,
        'expiresAt',l.expires_at,
        'source',l.source,
        'moderationVisible',l.moderation_visible,
        'publishedAt',l.published_at,
        'completedAt',l.completed_at,
        'deletedAt',l.deleted_at,
        'createdAt',l.created_at,
        'updatedAt',l.updated_at,
        'city',jsonb_build_object(
          'id',city.id,'slug',city.slug,'name',city.name,
          'countryCode',city.country_code,'timezone',city.timezone
        ),
        'category',jsonb_build_object(
          'id',category.id,'kind',category.kind,'slug',category.slug,'label',category.label
        ),
        'organizations',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',organization.id,'slug',organization.slug,'name',organization.name
          ) order by organization.name,organization.id)
          from public.listing_organizations link
          join public.organizations organization on organization.id=link.organization_id
          where link.listing_id=l.id
        ),'[]'::jsonb),
        'housing',case when l.kind='housing' then (
          select jsonb_build_object(
            'subtype',housing.subtype,
            'furnished',housing.furnished,
            'billsIncluded',housing.bills_included,
            'publicationRightsAcknowledged',housing.publication_rights_acknowledged,
            'permissionAcknowledged',housing.permission_acknowledged,
            'safetyWarningAcknowledged',housing.safety_warning_acknowledged
          ) from public.housing_details housing where housing.listing_id=l.id
        ) end,
        'item',case when l.kind='item' then (
          select jsonb_build_object(
            'condition',item.condition,
            'quantity',item.quantity,
            'pickupArea',item.pickup_area,
            'isGiveaway',item.is_giveaway
          ) from public.item_details item where item.listing_id=l.id
        ) end,
        'images',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',image.id,
            'status',image.status,
            'sortOrder',image.sort_order,
            'mediaType',image.original_media_type,
            'byteSize',image.byte_size,
            'width',image.width,
            'height',image.height,
            'errorCode',image.error_code,
            'createdAt',image.created_at,
            'updatedAt',image.updated_at
          ) order by image.sort_order,image.id)
          from public.listing_images image where image.listing_id=l.id
        ),'[]'::jsonb)
      ) order by l.created_at,l.id)
      from public.listings l
      join public.cities city on city.id=l.city_id
      join public.resource_categories category on category.id=l.resource_category_id
      where l.owner_id=p_user_id
    ),'[]'::jsonb),
    'sentContacts',coalesce((select jsonb_agg(jsonb_build_object('intentId',intent_id,'listingId',listing_id,'message',message_body,'status',status,'createdAt',created_at) order by created_at) from private.contact_outbox where sender_id=p_user_id),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(jsonb_build_object('listingId',listing_id,'reason',reason,'details',details,'status',status,'createdAt',created_at) order by created_at) from private.member_reports where reporter_id=p_user_id),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(role) from private.user_roles where user_id=p_user_id),'[]'::jsonb)
  ) into v_export;
  update private.privacy_requests set status='completed',completed_at=now() where id=p_request_id;
  return v_export;
end; $$;

create function private.contact_dispatch_is_eligible(
  p_outbox_id uuid,p_lease_token uuid default null
)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, private, auth as $$
  select exists(
    select 1
    from private.contact_outbox outbox
    join public.listings listing on listing.id=outbox.listing_id
    join public.profiles owner_profile on owner_profile.user_id=listing.owner_id
    join public.profiles sender_profile on sender_profile.user_id=outbox.sender_id
    join auth.users owner_user on owner_user.id=listing.owner_id
    join auth.users sender_user on sender_user.id=outbox.sender_id
    where outbox.id=p_outbox_id
      and (
        p_lease_token is null
        or (outbox.status='sending' and outbox.lease_token=p_lease_token)
      )
      and public.listing_is_contactable(
        listing.status,listing.moderation_visible,listing.expires_at,listing.deleted_at
      )
      and owner_profile.account_status='active' and owner_profile.deleted_at is null
      and sender_profile.account_status='active' and sender_profile.deleted_at is null
      and owner_user.email_confirmed_at is not null and owner_user.new_email is null
      and sender_user.email_confirmed_at is not null and sender_user.new_email is null
  );
$$;

create function private.cancel_ineligible_contact_outbox(p_user_id uuid default null)
returns integer language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_cancelled integer:=0; begin
  update private.contact_outbox outbox set
    status='failed',
    lease_token=null,
    leased_until=null,
    error_code=case when p_user_id is null then 'recipient-ineligible' else 'account-deleted' end,
    terminal_at=coalesce(outbox.terminal_at,now()),
    updated_at=now()
  where (
      outbox.status in ('queued','retrying')
      or (outbox.status='sending' and outbox.leased_until<=now())
    )
    and (
      p_user_id is null
      or outbox.sender_id=p_user_id
      or exists(
        select 1 from public.listings owned
        where owned.id=outbox.listing_id and owned.owner_id=p_user_id
      )
    )
    and not private.contact_dispatch_is_eligible(outbox.id);
  get diagnostics v_cancelled=row_count;
  return v_cancelled;
end; $$;

create or replace function public.admin_lease_contact_outbox(
  p_limit integer,p_lease_token uuid
)
returns table(
  outbox_id uuid,listing_id uuid,listing_title text,message_body text,
  idempotency_key text,owner_email text,sender_email text,attempt_number integer
)
language plpgsql security definer
set search_path = pg_catalog, public, private, auth as $$
begin
  perform private.cancel_ineligible_contact_outbox(null);
  return query
  with candidates as (
    select outbox.id
    from private.contact_outbox outbox
    where (
        (outbox.status in ('queued','retrying') and outbox.available_at<=now())
        or (outbox.status='sending' and outbox.leased_until<=now())
      )
      and outbox.attempts<5
      and (outbox.first_attempt_at is null or outbox.first_attempt_at>now()-interval '23 hours')
      and private.contact_dispatch_is_eligible(outbox.id)
    order by outbox.available_at,outbox.created_at
    for update skip locked
    limit least(greatest(p_limit,1),25)
  ), leased as (
    update private.contact_outbox outbox set
      status='sending',lease_token=p_lease_token,
      leased_until=now()+interval '2 minutes',attempts=outbox.attempts+1,
      first_attempt_at=coalesce(outbox.first_attempt_at,now()),updated_at=now()
    from candidates where outbox.id=candidates.id
    returning outbox.*
  )
  select leased.id,leased.listing_id,listing.title,leased.message_body,
    leased.idempotency_key,owner_user.email::text,sender_user.email::text,leased.attempts
  from leased
  join public.listings listing on listing.id=leased.listing_id
  join auth.users owner_user on owner_user.id=listing.owner_id
  join auth.users sender_user on sender_user.id=leased.sender_id;
end; $$;

create function public.admin_confirm_contact_dispatch(
  p_outbox_id uuid,p_lease_token uuid
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  if private.contact_dispatch_is_eligible(p_outbox_id,p_lease_token) then
    return true;
  end if;
  update private.contact_outbox set
    status='failed',lease_token=null,leased_until=null,
    error_code='recipient-ineligible',terminal_at=coalesce(terminal_at,now()),updated_at=now()
  where id=p_outbox_id and status='sending' and lease_token=p_lease_token;
  return false;
end; $$;

create or replace function public.admin_retry_contact_outbox(
  p_outbox_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_retry boolean; begin
  v_retry:=p_retryable
    and private.contact_dispatch_is_eligible(p_outbox_id,p_lease_token)
    and exists(
      select 1 from private.contact_outbox
      where id=p_outbox_id and attempts<5 and first_attempt_at>now()-interval '23 hours'
    );
  update private.contact_outbox set
    status=case when v_retry then 'retrying'::private.contact_delivery_status else 'failed'::private.contact_delivery_status end,
    available_at=case when v_retry then now()+make_interval(secs=>least(900,30*attempts*attempts)) else available_at end,
    terminal_at=case when v_retry then null else now() end,
    error_code=left(case when v_retry then p_error_code else coalesce(p_error_code,'recipient-ineligible') end,80),
    lease_token=null,leased_until=null,updated_at=now()
  where id=p_outbox_id and lease_token=p_lease_token and status='sending';
  return found;
end; $$;

create or replace function public.guard_pending_assisted_draft()
returns trigger language plpgsql
set search_path = pg_catalog, public, private as $$
begin
  if old.source='assisted' and new.status<>'draft'
    and not (
      new.status='withdrawn'
      and new.deleted_at is not null
      and new.moderation_visible is false
    )
    and not exists(
      select 1 from private.assisted_claims claim
      where claim.listing_id=old.id
        and claim.status='claimed'
        and claim.claimant_id=new.owner_id
    )
  then
    raise exception using errcode='42501',message='assisted draft requires a completed owner claim';
  end if;
  return new;
end; $$;

create function private.expire_assisted_drafts(
  p_now timestamptz,p_limit integer,p_token_hash text default null
)
returns integer language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_expired integer:=0; begin
  if p_limit<1 or p_limit>500 then
    raise exception using errcode='22023',message='invalid assisted expiry batch size';
  end if;
  with candidates as materialized (
    select claim.id,claim.listing_id
    from private.assisted_claims claim
    join public.listings listing on listing.id=claim.listing_id
    where listing.source='assisted' and listing.deleted_at is null
      and (
        (claim.status='pending' and claim.expires_at<=p_now)
        or claim.status='expired'
      )
      and (p_token_hash is null or claim.token_hash=p_token_hash)
    order by claim.expires_at,claim.id
    for update of claim skip locked
    limit p_limit
  ), expired_claims as (
    update private.assisted_claims claim set
      status='expired',consumed_at=coalesce(claim.consumed_at,p_now),updated_at=p_now
    from candidates where claim.id=candidates.id and claim.status='pending'
    returning claim.id
  ), deleted_images as (
    update public.listing_images image set
      status='deleted',generation=gen_random_uuid(),derivative_path=null,
      content_digest=null,error_code=null
    from candidates where image.listing_id=candidates.listing_id and image.status<>'deleted'
    returning image.id
  ), sanitized_items as (
    update public.item_details detail set
      pickup_area='Removed',quantity=1,is_giveaway=true
    from candidates where detail.listing_id=candidates.listing_id
    returning detail.listing_id
  ), deleted_organizations as (
    delete from public.listing_organizations link using candidates
    where link.listing_id=candidates.listing_id returning link.listing_id
  ), tombstoned as (
    update public.listings listing set
      title='Expired assisted draft',
      description='This unclaimed assisted draft expired and was removed.',
      approximate_area='Removed',price_amount=0,status='withdrawn',
      moderation_visible=false,deleted_at=p_now,version=listing.version+1
    from candidates where listing.id=candidates.listing_id and listing.deleted_at is null
    returning listing.id
  )
  select count(*) into v_expired from tombstoned;
  return v_expired;
end; $$;

create or replace function public.admin_inspect_assisted_claim(
  p_token_hash text,p_claimant_id uuid,p_author_email_hmac text
)
returns table(
  claim_id uuid,listing_id uuid,title text,description text,
  kind public.listing_kind,approximate_area text,source_label text,expires_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, private, auth as $$
begin
  perform private.expire_assisted_drafts(now(),1,p_token_hash);
  return query
  select claim.id,listing.id,listing.title,listing.description,listing.kind,
    listing.approximate_area,claim.source_label,claim.expires_at
  from private.assisted_claims claim
  join public.listings listing on listing.id=claim.listing_id
  join public.profiles profile on profile.user_id=p_claimant_id
  join auth.users account on account.id=p_claimant_id
  where claim.token_hash=p_token_hash and claim.author_email_hmac=p_author_email_hmac
    and claim.status='pending' and claim.expires_at>now()
    and profile.account_status='active' and profile.deleted_at is null
    and account.email_confirmed_at is not null and account.new_email is null;
end; $$;

create function public.admin_begin_account_deletion(p_user_id uuid,p_request_id uuid,p_receipt_code uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, auth as $$
declare v_paths jsonb;v_existing record; begin
  perform pg_advisory_xact_lock(hashtextextended('handover:administrator-role-lifecycle',0));
  select request.id,request.receipt_code,request.status into v_existing
  from private.privacy_requests request
  where request.id=p_request_id and request.user_id=p_user_id
    and request.request_type='delete'
  for update;
  if found then
    return jsonb_build_object(
      'requestId',v_existing.id,
      'receipt',v_existing.receipt_code,
      'status',case when v_existing.status='completed' then 'completed' else 'partial' end,
      'providerCleanup','{}'::jsonb,
      'shouldCleanup',false
    );
  end if;
  if exists(select 1 from private.user_roles where user_id=p_user_id and role='administrator')
    and (select count(*) from private.user_roles r join public.profiles p on p.user_id=r.user_id
      where r.role='administrator' and p.account_status='active' and p.deleted_at is null)<=1
  then raise exception using errcode='23514',message='last administrator cannot delete account'; end if;
  if not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active' and deleted_at is null)
  then raise exception using errcode='42501',message='deletion unavailable'; end if;
  insert into private.privacy_requests(id,user_id,request_type,status,receipt_code)
  values(p_request_id,p_user_id,'delete','processing',p_receipt_code);
  with candidates as materialized (
    select i.id,i.storage_path,i.derivative_path from public.listing_images i
    join public.listings l on l.id=i.listing_id where l.owner_id=p_user_id
    for update of i
  ), changed as (
    update public.listing_images i set status='deleted',generation=gen_random_uuid(),
      derivative_path=null,content_digest=null,error_code=null
    from candidates c where i.id=c.id returning c.storage_path,c.derivative_path
  )
  select jsonb_build_object(
    'staging',coalesce(jsonb_agg(storage_path) filter(where storage_path is not null),'[]'::jsonb),
    'media',coalesce(jsonb_agg(derivative_path) filter(where derivative_path is not null),'[]'::jsonb)
  ) into v_paths from changed;
  v_paths := v_paths || jsonb_build_object('authUserId',p_user_id);
  update private.privacy_requests set
    provider_cleanup=v_paths,
    status='partial',
    error_code='provider-cleanup-pending',
    completed_at=now(),
    cleanup_available_at=now()+interval '10 minutes'
  where id=p_request_id;

  update private.assisted_claims set status='revoked',consumed_at=now(),updated_at=now()
  where operator_id=p_user_id and status='pending';
  update private.contact_outbox o set message_body='[message removed after account deletion]',
    body_purged_at=coalesce(body_purged_at,now()),updated_at=now()
  where o.sender_id=p_user_id or exists(select 1 from public.listings l where l.id=o.listing_id and l.owner_id=p_user_id);
  update private.contact_outbox o set status='failed',lease_token=null,leased_until=null,
    error_code='account-deleted',terminal_at=coalesce(terminal_at,now()),updated_at=now()
  where o.status in ('queued','retrying') and (
    o.sender_id=p_user_id
    or exists(select 1 from public.listings l where l.id=o.listing_id and l.owner_id=p_user_id)
  );
  update private.contact_intents i set message_body='[message removed after account deletion]'
  where i.sender_id=p_user_id or exists(
    select 1 from public.listings l where l.id=i.listing_id and l.owner_id=p_user_id
  );
  update private.notification_outbox set status='failed',lease_token=null,leased_until=null,
    error_code='account-deleted',updated_at=now()
  where recipient_id=p_user_id and status in ('queued','retrying');
  update public.item_details detail set
    pickup_area='Removed',quantity=1,is_giveaway=true
  from public.listings listing
  where detail.listing_id=listing.id and listing.owner_id=p_user_id;
  delete from public.listing_organizations link
  using public.listings listing
  where link.listing_id=listing.id and listing.owner_id=p_user_id;
  with changed as (
    update public.listings set
      title='Deleted listing',
      description='This listing was removed after account deletion.',
      approximate_area='Removed',
      price_amount=0,
      status=case when status in ('draft','active','reserved') then 'withdrawn'::public.listing_status else status end,
      moderation_visible=false,deleted_at=coalesce(deleted_at,now()),version=version+1
    where owner_id=p_user_id
    returning id,version
  )
  insert into private.cache_invalidation_outbox(aggregate_type,aggregate_id,aggregate_version,reason)
  select 'listing',id,version,'account-deletion' from changed on conflict do nothing;
  insert into private.role_audit(actor_id,target_id,role,action)
  select p_user_id,p_user_id,role,'revoke' from private.user_roles where user_id=p_user_id;
  delete from private.user_roles where user_id=p_user_id;
  update public.profiles set account_status='deleted',deleted_at=now(),display_name=null where user_id=p_user_id;
  perform private.cancel_ineligible_contact_outbox(p_user_id);
  return jsonb_build_object(
    'requestId',p_request_id,
    'receipt',p_receipt_code,
    'status','partial',
    'providerCleanup',v_paths,
    'shouldCleanup',true
  );
end; $$;

create function public.admin_recover_account_deletion(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, private as $$
declare v_result jsonb; begin
  select jsonb_build_object(
    'receipt',request.receipt_code,
    'status',case when request.status='completed' then 'completed' else 'partial' end
  ) into v_result
  from private.privacy_requests request
  where request.id=p_request_id and request.request_type='delete';
  return v_result;
end; $$;

create function public.admin_finish_privacy_request(p_request_id uuid,p_status text,p_error_code text default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  if p_status not in ('completed','partial','failed') then raise exception using errcode='23514',message='privacy status invalid'; end if;
  update private.privacy_requests set
    status=p_status,
    error_code=left(p_error_code,120),
    provider_cleanup=case when p_status='completed' then '{}'::jsonb else provider_cleanup end,
    completed_at=now()
  where id=p_request_id and status in ('processing','partial');
  return found;
end; $$;

create or replace function public.admin_manage_role(
  p_actor_id uuid,p_target_id uuid,p_role private.app_role,p_action text
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private, auth as $$
begin
  if p_role='administrator' then
    perform pg_advisory_xact_lock(hashtextextended('handover:administrator-role-lifecycle',0));
  end if;
  if not public.admin_actor_has_any_role(p_actor_id,array['administrator'])
    or p_actor_id=p_target_id or p_action not in ('grant','revoke')
  then raise exception using errcode='42501',message='role action forbidden'; end if;
  if p_action='revoke' and p_role='administrator'
    and (select count(*) from private.user_roles role_assignment
      join public.profiles profile on profile.user_id=role_assignment.user_id
      where role_assignment.role='administrator'
        and profile.account_status='active' and profile.deleted_at is null)<=1
  then raise exception using errcode='23514',message='last administrator cannot be removed'; end if;
  if p_action='grant' then
    insert into private.user_roles(user_id,role,granted_by)
    values(p_target_id,p_role,p_actor_id) on conflict do nothing;
  else
    delete from private.user_roles where user_id=p_target_id and role=p_role;
  end if;
  insert into private.role_audit(actor_id,target_id,role,action)
  values(p_actor_id,p_target_id,p_role,p_action);
  insert into private.notification_outbox(recipient_id,template_kind,payload,idempotency_key)
  values(
    p_target_id,'role-changed',jsonb_build_object('role',p_role,'action',p_action),
    'role/'||p_target_id::text||'/'||p_role::text||'/'||extract(epoch from now())::bigint
  );
  return true;
end; $$;

create function public.admin_lease_storage_cleanup(p_limit integer,p_lease_token uuid)
returns table(
  cleanup_id bigint,bucket text,object_path text,attempt_number integer
)
language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  if p_limit<1 or p_limit>100 then
    raise exception using errcode='22023',message='invalid storage cleanup batch size';
  end if;
  return query
  with candidates as (
    select cleanup.id
    from private.storage_cleanup_outbox cleanup
    where (
        (cleanup.status in ('queued','retrying') and cleanup.available_at<=now())
        or (cleanup.status='leased' and cleanup.leased_until<=now())
      )
      and cleanup.attempts<10
    order by cleanup.available_at,cleanup.id
    for update skip locked limit p_limit
  ), leased as (
    update private.storage_cleanup_outbox cleanup set
      status='leased',attempts=cleanup.attempts+1,
      lease_token=p_lease_token,leased_until=now()+interval '5 minutes',updated_at=now()
    from candidates where cleanup.id=candidates.id
    returning cleanup.id,cleanup.bucket,cleanup.object_path,cleanup.attempts
  )
  select leased.id,leased.bucket,leased.object_path,leased.attempts from leased;
end; $$;

create function public.admin_finish_storage_cleanup(
  p_cleanup_id bigint,p_lease_token uuid,p_succeeded boolean,p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  update private.storage_cleanup_outbox set
    status=case
      when p_succeeded then 'completed'
      when attempts>=10 then 'failed'
      else 'retrying'
    end,
    available_at=case when p_succeeded then available_at
      else now()+least(interval '24 hours',interval '15 minutes'*power(2,attempts-1)::double precision)
    end,
    lease_token=null,leased_until=null,
    error_code=case when p_succeeded then null
      when attempts>=10 then 'storage-cleanup-exhausted'
      else left(coalesce(p_error_code,'storage-cleanup-failed'),120)
    end,
    completed_at=case when p_succeeded then now() else completed_at end,
    updated_at=now()
  where id=p_cleanup_id and status='leased' and lease_token=p_lease_token;
  if found and not p_succeeded then
    insert into private.job_state(job_name,last_failed_at,consecutive_failures,last_result)
    values('storage-cleanup',now(),1,jsonb_build_object(
      'errorCode',left(coalesce(p_error_code,'storage-cleanup-failed'),120)
    ))
    on conflict(job_name) do update set
      last_failed_at=excluded.last_failed_at,
      consecutive_failures=private.job_state.consecutive_failures+1,
      last_result=excluded.last_result;
  end if;
  return found;
end; $$;

create function public.admin_lease_privacy_cleanups(p_limit integer,p_lease_token uuid)
returns table(request_id uuid,user_id uuid,provider_cleanup jsonb)
language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  if p_limit<1 or p_limit>25 then raise exception using errcode='22023',message='invalid cleanup batch size'; end if;
  return query
  with candidates as (
    select id from private.privacy_requests
    where request_type='delete' and status='partial' and cleanup_attempts<10
      and cleanup_available_at<=now() and (cleanup_leased_until is null or cleanup_leased_until<=now())
    order by cleanup_available_at,id for update skip locked limit p_limit
  ), leased as (
    update private.privacy_requests r set cleanup_lease_token=p_lease_token,
      cleanup_leased_until=now()+interval '5 minutes'
    from candidates c where r.id=c.id
    returning r.id,r.user_id,r.provider_cleanup
  )
  select l.id,l.user_id,l.provider_cleanup from leased l;
end; $$;

create function public.admin_finish_privacy_cleanup_retry(
  p_request_id uuid,p_lease_token uuid,p_succeeded boolean,p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  update private.privacy_requests set
    status=case
      when p_succeeded then 'completed'
      when cleanup_attempts>=9 then 'failed'
      else 'partial'
    end,
    error_code=case
      when p_succeeded then null
      when cleanup_attempts>=9 then 'provider-cleanup-exhausted'
      else left(coalesce(p_error_code,'provider-cleanup-pending'),120)
    end,
    provider_cleanup=case when p_succeeded then '{}'::jsonb else provider_cleanup end,
    cleanup_attempts=cleanup_attempts+1,
    cleanup_available_at=case when p_succeeded then cleanup_available_at else now()+least(interval '24 hours',interval '15 minutes'*power(2,cleanup_attempts)::double precision) end,
    cleanup_lease_token=null,cleanup_leased_until=null,completed_at=now()
  where id=p_request_id and status='partial' and cleanup_lease_token=p_lease_token;
  if found and not p_succeeded then
    insert into private.job_state(job_name,last_failed_at,consecutive_failures,last_result)
    values('privacy-cleanup',now(),1,jsonb_build_object(
      'errorCode',case when (
        select cleanup_attempts>=10 from private.privacy_requests where id=p_request_id
      ) then 'provider-cleanup-exhausted' else left(coalesce(p_error_code,'provider-cleanup-pending'),120) end
    ))
    on conflict(job_name) do update set
      last_failed_at=excluded.last_failed_at,
      consecutive_failures=private.job_state.consecutive_failures+1,
      last_result=excluded.last_result;
  end if;
  return found;
end; $$;

create function public.admin_run_retention(p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_expired integer:=0;v_bodies integer:=0;v_images integer:=0;
  v_assisted integer:=0;v_result jsonb; begin
  insert into private.job_state(job_name,last_started_at) values('retention',p_now)
  on conflict(job_name) do update set last_started_at=excluded.last_started_at;
  with candidates as materialized (
    select id from public.listings
    where status in ('active','reserved') and expires_at<=p_now and deleted_at is null
    order by expires_at,id for update skip locked limit 500
  ), changed as (
    update public.listings l set status='expired',version=l.version+1
    from candidates c where l.id=c.id returning l.id,l.version
  ), invalidations as (
    insert into private.cache_invalidation_outbox(aggregate_type,aggregate_id,aggregate_version,reason)
    select 'listing',id,version,'expiry' from changed on conflict do nothing returning 1
  ) select count(*) into v_expired from changed;

  with candidates as materialized (
    select id from private.contact_outbox
    where body_purged_at is null and created_at<p_now-interval '30 days'
    order by created_at,id for update skip locked limit 500
  )
  update private.contact_outbox o set message_body='[message purged after retention period]',
    body_purged_at=p_now,updated_at=p_now from candidates c where o.id=c.id;
  get diagnostics v_bodies=row_count;
  with candidates as materialized (
    select id from private.contact_intents
    where created_at<p_now-interval '30 days' and message_body<>'[message purged after retention period]'
    order by created_at,id for update skip locked limit 500
  )
  update private.contact_intents i set message_body='[message purged after retention period]'
  from candidates c where i.id=c.id;
  v_assisted:=private.expire_assisted_drafts(p_now,500,null);
  perform private.cancel_ineligible_contact_outbox(null);

  with candidates as materialized (
    select i.id from public.listing_images i
    join public.listings l on l.id=i.listing_id
    where i.status<>'deleted' and (
      l.deleted_at is not null
      or (i.status in ('staged','processing','failed') and i.updated_at<p_now-interval '24 hours')
    )
    order by i.updated_at,i.id for update of i skip locked limit 100
  ), changed as (
    update public.listing_images i set status='deleted',generation=gen_random_uuid(),
      derivative_path=null,content_digest=null,error_code=null
    from candidates c where i.id=c.id returning i.id
  )
  select count(*) into v_images from changed;
  delete from private.auth_intents where id in (
    select id from private.auth_intents where created_at<p_now-interval '24 hours'
    order by created_at,id for update skip locked limit 500
  );
  delete from private.captcha_challenges where challenge_hash in (
    select challenge_hash from private.captcha_challenges where expires_at<p_now-interval '24 hours'
    order by expires_at,challenge_hash for update skip locked limit 500
  );
  delete from private.rate_limit_buckets where (scope,key_hash,window_started_at) in (
    select scope,key_hash,window_started_at from private.rate_limit_buckets
    where window_started_at<p_now-interval '7 days'
    order by window_started_at,scope,key_hash for update skip locked limit 1000
  );
  v_result:=jsonb_build_object(
    'expiredListings',v_expired,
    'purgedContactBodies',v_bodies,
    'cleanedImages',v_images,
    'expiredAssistedDrafts',v_assisted,
    'failedPrivacyCleanups',(
      select count(*) from private.privacy_requests
      where request_type='delete' and status='failed' and provider_cleanup<>'{}'::jsonb
    ),
    'pendingStorageCleanups',(
      select count(*) from private.storage_cleanup_outbox
      where status in ('queued','leased','retrying','failed')
    ),
    'hasMore',v_expired=500 or v_bodies=500 or v_images=100 or v_assisted=500
  );
  return v_result;
end; $$;

create function public.admin_finish_retention_run(p_started_at timestamptz,p_result jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  if exists(
      select 1 from private.storage_cleanup_outbox
      where status in ('queued','leased','retrying','failed')
    ) or exists(
      select 1 from private.privacy_requests
      where request_type='delete' and status in ('partial','failed')
        and provider_cleanup<>'{}'::jsonb
    )
  then
    return false;
  end if;
  update private.job_state set
    last_succeeded_at=now(),consecutive_failures=0,
    last_result=jsonb_build_object(
      'expiredListings',coalesce(p_result->'expiredListings','0'::jsonb),
      'purgedContactBodies',coalesce(p_result->'purgedContactBodies','0'::jsonb),
      'cleanedImages',coalesce(p_result->'cleanedImages','0'::jsonb),
      'expiredAssistedDrafts',coalesce(p_result->'expiredAssistedDrafts','0'::jsonb),
      'storageCompleted',coalesce(p_result#>'{storageCleanup,completed}','0'::jsonb),
      'privacyCompleted',coalesce(p_result#>'{privacyCleanup,completed}','0'::jsonb),
      'hasMore',coalesce(p_result->'hasMore','false'::jsonb)
    )
  where job_name='retention' and last_started_at=p_started_at;
  return found;
end; $$;

create function public.admin_record_retention_cleanup_failure(p_error_code text)
returns void language plpgsql security definer set search_path = pg_catalog, private as $$
begin
  insert into private.job_state(job_name,last_failed_at,consecutive_failures,last_result)
  values('retention',now(),1,jsonb_build_object('errorCode',left(p_error_code,120)))
  on conflict(job_name) do update set
    last_failed_at=excluded.last_failed_at,
    consecutive_failures=private.job_state.consecutive_failures+1,
    last_result=excluded.last_result;
end; $$;

revoke execute on function public.admin_export_user_data(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_begin_account_deletion(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_recover_account_deletion(uuid) from public,anon,authenticated;
revoke execute on function public.admin_finish_privacy_request(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.admin_run_retention(timestamptz) from public,anon,authenticated;
revoke execute on function public.admin_finish_retention_run(timestamptz,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_record_retention_cleanup_failure(text) from public,anon,authenticated;
revoke execute on function public.admin_lease_privacy_cleanups(integer,uuid) from public,anon,authenticated;
revoke execute on function public.admin_finish_privacy_cleanup_retry(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke execute on function public.admin_lease_storage_cleanup(integer,uuid) from public,anon,authenticated;
revoke execute on function public.admin_finish_storage_cleanup(bigint,uuid,boolean,text) from public,anon,authenticated;
revoke execute on function public.admin_confirm_contact_dispatch(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.admin_lease_contact_outbox(integer,uuid) from public,anon,authenticated;
revoke execute on function public.admin_retry_contact_outbox(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke execute on function public.admin_manage_role(uuid,uuid,private.app_role,text) from public,anon,authenticated;
revoke execute on function public.admin_inspect_assisted_claim(text,uuid,text) from public,anon,authenticated;
revoke execute on function private.enqueue_listing_image_cleanup() from public,anon,authenticated;
revoke execute on function private.contact_dispatch_is_eligible(uuid,uuid) from public,anon,authenticated;
revoke execute on function private.cancel_ineligible_contact_outbox(uuid) from public,anon,authenticated;
revoke execute on function private.expire_assisted_drafts(timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.admin_export_user_data(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_begin_account_deletion(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_recover_account_deletion(uuid) to service_role;
grant execute on function public.admin_finish_privacy_request(uuid,text,text) to service_role;
grant execute on function public.admin_run_retention(timestamptz) to service_role;
grant execute on function public.admin_finish_retention_run(timestamptz,jsonb) to service_role;
grant execute on function public.admin_record_retention_cleanup_failure(text) to service_role;
grant execute on function public.admin_lease_privacy_cleanups(integer,uuid) to service_role;
grant execute on function public.admin_finish_privacy_cleanup_retry(uuid,uuid,boolean,text) to service_role;
grant execute on function public.admin_lease_storage_cleanup(integer,uuid) to service_role;
grant execute on function public.admin_finish_storage_cleanup(bigint,uuid,boolean,text) to service_role;
grant execute on function public.admin_confirm_contact_dispatch(uuid,uuid) to service_role;
grant execute on function public.admin_lease_contact_outbox(integer,uuid) to service_role;
grant execute on function public.admin_retry_contact_outbox(uuid,uuid,text,boolean) to service_role;
grant execute on function public.admin_manage_role(uuid,uuid,private.app_role,text) to service_role;
grant execute on function public.admin_inspect_assisted_claim(text,uuid,text) to service_role;
grant execute on function private.enqueue_listing_image_cleanup() to service_role;
grant execute on function private.contact_dispatch_is_eligible(uuid,uuid) to service_role;
grant execute on function private.cancel_ineligible_contact_outbox(uuid) to service_role;
grant execute on function private.expire_assisted_drafts(timestamptz,integer,text) to service_role;
