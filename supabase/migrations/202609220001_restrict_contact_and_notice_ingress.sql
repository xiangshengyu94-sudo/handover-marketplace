-- Expand phase: install service-only contact wrappers before deploying the
-- application. Leave the old client grants intact until the new build is live.
create function public.admin_issue_contact_intent(
  p_sender_id uuid,
  p_id uuid,
  p_request_key uuid,
  p_listing_id uuid,
  p_token_hash text,
  p_payload_hash text,
  p_message_body text,
  p_expires_at timestamptz
)
returns table (intent_id uuid, intent_expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_sender_id is null then
    raise exception using errcode = '42501', message = 'sender required';
  end if;
  perform set_config('request.jwt.claim.sub', p_sender_id::text, true);
  return query select i.intent_id, i.intent_expires_at
    from public.issue_contact_intent(
      p_id, p_request_key, p_listing_id, p_token_hash,
      p_payload_hash, p_message_body, p_expires_at
    ) i;
end;
$$;

create function public.admin_consume_contact_intent(
  p_sender_id uuid,
  p_token_hash text,
  p_listing_id uuid,
  p_payload_hash text,
  p_message_body text
)
returns table (
  intent_id uuid,
  outbox_id uuid,
  delivery_status text,
  delivery_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_sender_id is null then
    raise exception using errcode = '42501', message = 'sender required';
  end if;
  perform set_config('request.jwt.claim.sub', p_sender_id::text, true);
  return query select c.intent_id, c.outbox_id, c.delivery_status, c.delivery_updated_at
    from public.consume_contact_intent(
      p_token_hash, p_listing_id, p_payload_hash, p_message_body
    ) c;
end;
$$;

revoke execute on function public.admin_issue_contact_intent(uuid, uuid, uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_consume_contact_intent(uuid, text, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.issue_contact_intent(uuid, uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.consume_contact_intent(text, uuid, text, text)
  to service_role;
grant execute on function public.submit_illegal_content_notice(uuid, text, text, boolean)
  to service_role;
grant execute on function public.admin_issue_contact_intent(uuid, uuid, uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.admin_consume_contact_intent(uuid, text, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
