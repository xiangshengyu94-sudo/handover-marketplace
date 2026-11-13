create type public.community_post_type as enum ('question', 'experience');

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete restrict,
  type public.community_post_type not null,
  title text not null check (char_length(title) between 8 and 120),
  body text not null check (char_length(body) between 20 and 4000),
  related_question_id uuid references public.community_posts (id) on delete set null,
  moderation_visible boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (type = 'experience' or related_question_id is null)
);

create table public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 20 and 4000),
  moderation_visible boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index community_posts_feed_idx on public.community_posts (city_id, type, created_at desc, id desc)
  where moderation_visible and deleted_at is null;
create index community_posts_global_feed_idx on public.community_posts (created_at desc, id desc)
  where moderation_visible and deleted_at is null;
create index community_posts_city_feed_idx on public.community_posts (city_id, created_at desc, id desc)
  where moderation_visible and deleted_at is null;
create index community_posts_type_feed_idx on public.community_posts (type, created_at desc, id desc)
  where moderation_visible and deleted_at is null;
create index community_posts_author_idx on public.community_posts (author_id);
create index community_posts_related_idx on public.community_posts (related_question_id, created_at desc)
  where related_question_id is not null and moderation_visible and deleted_at is null;
create index community_answers_question_idx on public.community_answers (question_id, created_at)
  where moderation_visible and deleted_at is null;
create index community_answers_author_idx on public.community_answers (author_id);

create function public.validate_community_post()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  organization_city uuid;
  organization_status public.taxonomy_status;
begin
  if new.deleted_at is not null then return new; end if;
  if not exists (select 1 from public.cities where id = new.city_id and status = 'active') then
    raise exception using errcode = '23514', message = 'community city is not active';
  end if;
  if new.organization_id is not null then
    select city_id, status into organization_city, organization_status
    from public.organizations where id = new.organization_id;
    if organization_status is distinct from 'active'
      or (organization_city is not null and organization_city <> new.city_id) then
      raise exception using errcode = '23514', message = 'community organization does not match city';
    end if;
  end if;
  if new.related_question_id is not null and not exists (
    select 1 from public.community_posts q where q.id = new.related_question_id
      and q.type = 'question' and q.city_id = new.city_id
      and q.moderation_visible and q.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'related question is unavailable in this city';
  end if;
  if not public.public_text_is_safe(new.title) or not public.public_text_is_safe(new.body) then
    raise exception using errcode = '23514', message = 'community post text is unsafe';
  end if;
  return new;
end;
$$;

create trigger community_posts_validate before insert or update of city_id, organization_id, type, title, body, related_question_id
on public.community_posts for each row execute function public.validate_community_post();

create function public.validate_community_answer()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.deleted_at is not null then return new; end if;
  if not exists (
    select 1 from public.community_posts q where q.id = new.question_id
      and q.type = 'question' and q.moderation_visible and q.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'question is unavailable';
  end if;
  if not public.public_text_is_safe(new.body) then
    raise exception using errcode = '23514', message = 'community answer text is unsafe';
  end if;
  return new;
end;
$$;

create trigger community_answers_validate before insert or update of question_id, body
on public.community_answers for each row execute function public.validate_community_answer();

create function public.purge_deleted_member_community_content()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.account_status = 'deleted' and old.account_status is distinct from 'deleted' then
    update public.community_answers set
      body = 'This answer was removed after account deletion.',
      moderation_visible = false, deleted_at = coalesce(deleted_at, now())
    where author_id = new.user_id;
    update public.community_posts set
      title = 'Deleted community post',
      body = 'This post was removed after account deletion.',
      moderation_visible = false, deleted_at = coalesce(deleted_at, now())
    where author_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger profiles_purge_community_content after update of account_status
on public.profiles for each row execute function public.purge_deleted_member_community_content();

alter table public.community_posts enable row level security;
alter table public.community_posts force row level security;
alter table public.community_answers enable row level security;
alter table public.community_answers force row level security;
revoke all on public.community_posts, public.community_answers from public, anon, authenticated;

create function public.community_author_is_eligible()
returns boolean language sql stable security definer set search_path = pg_catalog, public, auth as $$
  select public.current_user_is_active() and exists (
    select 1 from auth.users u where u.id = auth.uid()
      and u.email_confirmed_at is not null and nullif(u.email_change, '') is null
  );
$$;

create policy community_posts_read on public.community_posts for select to anon, authenticated
using (moderation_visible and deleted_at is null);
create policy community_posts_create on public.community_posts for insert to authenticated
with check (author_id = auth.uid() and public.community_author_is_eligible());
create policy community_answers_read on public.community_answers for select to anon, authenticated
using (
  moderation_visible and deleted_at is null and exists (
    select 1 from public.community_posts q where q.id = question_id
      and q.type = 'question' and q.moderation_visible and q.deleted_at is null
  )
);
create policy community_answers_create on public.community_answers for insert to authenticated
with check (
  author_id = auth.uid() and public.community_author_is_eligible() and exists (
    select 1 from public.community_posts q where q.id = question_id
      and q.type = 'question' and q.moderation_visible and q.deleted_at is null
  )
);

grant select (id, city_id, organization_id, type, title, body, related_question_id, created_at)
  on public.community_posts to anon, authenticated;
grant select (id, question_id, body, created_at)
  on public.community_answers to anon, authenticated;
grant insert (author_id, city_id, organization_id, type, title, body, related_question_id)
  on public.community_posts to authenticated;
grant insert (question_id, author_id, body)
  on public.community_answers to authenticated;
grant all on public.community_posts, public.community_answers to service_role;
revoke execute on function public.validate_community_post() from public, anon, authenticated;
revoke execute on function public.validate_community_answer() from public, anon, authenticated;
revoke execute on function public.purge_deleted_member_community_content() from public, anon, authenticated;
revoke execute on function public.community_author_is_eligible() from public, anon;
grant execute on function public.community_author_is_eligible() to authenticated;
