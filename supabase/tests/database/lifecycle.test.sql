begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select ok(
  public.listing_is_public('active', true, '2026-08-08 12:00:00+00', null, '2026-08-08 11:59:59.999999+00'),
  'active listing is public one instant before expiry'
);
select ok(
  not public.listing_is_public('active', true, '2026-08-08 12:00:00+00', null, '2026-08-08 12:00:00+00'),
  'active listing is not public exactly at expiry'
);
select ok(
  not public.listing_is_public('active', true, '2026-08-08 12:00:00+00', null, '2026-08-08 12:00:00.000001+00'),
  'active listing is not public after expiry'
);
select ok(
  public.listing_is_public('reserved', true, '2026-08-08 12:00:00+00', null, '2026-08-08 11:00:00+00'),
  'reserved listing remains readable before expiry'
);
select ok(
  not public.listing_is_public('draft', true, '2026-08-08 12:00:00+00', null, '2026-08-08 11:00:00+00'),
  'draft is not public'
);
select ok(
  public.listing_is_contactable('active', true, '2026-08-08 12:00:00+00', null, '2026-08-08 11:00:00+00'),
  'active public listing is contactable'
);
select ok(
  not public.listing_is_contactable('reserved', true, '2026-08-08 12:00:00+00', null, '2026-08-08 11:00:00+00'),
  'reserved listing is not contactable'
);
select ok(public.listing_transition_allowed('draft', 'active'), 'draft can publish');
select ok(not public.listing_transition_allowed('draft', 'reserved'), 'draft cannot reserve directly');
select ok(public.listing_transition_allowed('reserved', 'active'), 'reserved can reopen');
select ok(public.listing_transition_allowed('expired', 'active'), 'expired listing can renew');
select ok(not public.listing_transition_allowed('completed', 'reserved'), 'completed listing cannot reserve directly');

select * from finish();
rollback;
