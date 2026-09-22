-- Contract phase: run only after every application instance uses the
-- service-only wrappers installed by 202609220001.
revoke execute on function public.issue_contact_intent(uuid, uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.consume_contact_intent(text, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.submit_illegal_content_notice(uuid, text, text, boolean)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
