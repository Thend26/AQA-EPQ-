create extension if not exists pgcrypto;

create or replace function public.valid_behavior_tags(tags text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select
    cardinality(tags) <= 12
    and not exists (
      select 1
      from unnest(tags) as tag
      where tag <> btrim(tag)
        or char_length(tag) < 1
        or char_length(tag) > 60
    )
    and cardinality(tags) = (
      select count(distinct tag)
      from unnest(tags) as tag
    );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
    check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null
    check (
      btrim(display_name) <> ''
      and char_length(display_name) <= 80
    ),
  grade text not null check (grade in ('10', '11')),
  project_title text not null
    check (
      btrim(project_title) <> ''
      and char_length(project_title) <= 300
    ),
  camp_start_date date not null,
  background_notes text not null default ''
    check (char_length(background_notes) <= 2000),
  current_focus text not null default ''
    check (char_length(current_focus) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.daily_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null,
  record_date date not null,
  camp_day integer not null check (camp_day between 1 and 100),
  achievements text not null
    check (
      btrim(achievements) <> ''
      and char_length(achievements) <= 4000
    ),
  evidence text not null default ''
    check (char_length(evidence) <= 4000),
  challenges text not null default ''
    check (char_length(challenges) <= 4000),
  process_notes text not null default ''
    check (char_length(process_notes) <= 4000),
  ao1_note text not null default ''
    check (char_length(ao1_note) <= 2000),
  ao2_note text not null default ''
    check (char_length(ao2_note) <= 2000),
  ao3_note text not null default ''
    check (char_length(ao3_note) <= 2000),
  ao4_note text not null default ''
    check (char_length(ao4_note) <= 2000),
  next_plan text not null
    check (
      btrim(next_plan) <> ''
      and char_length(next_plan) <= 4000
    ),
  behavior_tags text[] not null default '{}'
    check (public.valid_behavior_tags(behavior_tags)),
  status text not null default 'draft'
    check (status in ('draft', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_records_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade,
  unique (id, student_id, owner_id),
  unique (student_id, record_date)
);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null,
  daily_record_id uuid not null,
  language_mode text not null
    check (language_mode in ('zh', 'en', 'bilingual')),
  content_zh text check (
    content_zh is null or char_length(content_zh) <= 12000
  ),
  content_en text check (
    content_en is null or char_length(content_en) <= 12000
  ),
  context_record_ids uuid[] not null default '{}'
    check (cardinality(context_record_ids) <= 100),
  status text not null default 'draft'
    check (status in ('draft', 'final')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedbacks_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade,
  constraint feedbacks_daily_record_owner_fk
    foreign key (daily_record_id, student_id, owner_id)
    references public.daily_records (id, student_id, owner_id)
    on delete cascade,
  unique (id, owner_id),
  unique (id, student_id, owner_id)
);

comment on column public.feedbacks.context_record_ids is
  'Generation-time snapshot only; feedback_context_records is authoritative.';

create table public.feedback_context_records (
  owner_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null,
  feedback_id uuid not null,
  daily_record_id uuid not null,
  created_at timestamptz not null default now(),
  constraint feedback_context_records_feedback_owner_fk
    foreign key (feedback_id, student_id, owner_id)
    references public.feedbacks (id, student_id, owner_id)
    on delete cascade,
  constraint feedback_context_records_daily_record_owner_fk
    foreign key (daily_record_id, student_id, owner_id)
    references public.daily_records (id, student_id, owner_id)
    on delete cascade,
  primary key (feedback_id, daily_record_id)
);

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  feedback_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null
    check (
      btrim(content) <> ''
      and char_length(content) <= 12000
    ),
  created_at timestamptz not null default now(),
  constraint feedback_messages_feedback_owner_fk
    foreign key (feedback_id, owner_id)
    references public.feedbacks (id, owner_id)
    on delete cascade
);

create table public.student_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null,
  summary_text text not null
    check (
      btrim(summary_text) <> ''
      and char_length(summary_text) <= 12000
    ),
  through_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_summaries_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade,
  unique (student_id)
);

create or replace function public.prevent_daily_record_identity_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.student_id is distinct from old.student_id
  then
    raise exception
      'daily_records id, owner_id, and student_id cannot be updated'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_daily_record_identity_update() from public;

create trigger daily_records_prevent_identity_update
before update of id, owner_id, student_id
on public.daily_records
for each row
execute function public.prevent_daily_record_identity_update();

create or replace function public.prevent_feedback_identity_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.student_id is distinct from old.student_id
  then
    raise exception
      'feedbacks id, owner_id, and student_id cannot be updated'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_feedback_identity_update() from public;

create trigger feedbacks_prevent_identity_update
before update of id, owner_id, student_id
on public.feedbacks
for each row
execute function public.prevent_feedback_identity_update();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.daily_records enable row level security;
alter table public.feedbacks enable row level security;
alter table public.feedback_context_records enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.student_summaries enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_delete_own"
on public.profiles for delete
using (id = auth.uid());

create policy "students_select_own"
on public.students for select
using (owner_id = auth.uid());

create policy "students_insert_own"
on public.students for insert
with check (owner_id = auth.uid());

create policy "students_update_own"
on public.students for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "students_delete_own"
on public.students for delete
using (owner_id = auth.uid());

create policy "daily_records_select_own"
on public.daily_records for select
using (owner_id = auth.uid());

create policy "daily_records_insert_own"
on public.daily_records for insert
with check (owner_id = auth.uid());

create policy "daily_records_update_own"
on public.daily_records for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "daily_records_delete_own"
on public.daily_records for delete
using (owner_id = auth.uid());

create policy "feedbacks_select_own"
on public.feedbacks for select
using (owner_id = auth.uid());

create policy "feedbacks_insert_own"
on public.feedbacks for insert
with check (owner_id = auth.uid());

create policy "feedbacks_update_own"
on public.feedbacks for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "feedbacks_delete_own"
on public.feedbacks for delete
using (owner_id = auth.uid());

create policy "feedback_context_records_select_own"
on public.feedback_context_records for select
using (owner_id = auth.uid());

create policy "feedback_context_records_insert_own"
on public.feedback_context_records for insert
with check (owner_id = auth.uid());

create policy "feedback_context_records_update_own"
on public.feedback_context_records for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "feedback_context_records_delete_own"
on public.feedback_context_records for delete
using (owner_id = auth.uid());

create policy "feedback_messages_select_own"
on public.feedback_messages for select
using (owner_id = auth.uid());

create policy "feedback_messages_insert_own"
on public.feedback_messages for insert
with check (owner_id = auth.uid());

create policy "feedback_messages_update_own"
on public.feedback_messages for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "feedback_messages_delete_own"
on public.feedback_messages for delete
using (owner_id = auth.uid());

create policy "student_summaries_select_own"
on public.student_summaries for select
using (owner_id = auth.uid());

create policy "student_summaries_insert_own"
on public.student_summaries for insert
with check (owner_id = auth.uid());

create policy "student_summaries_update_own"
on public.student_summaries for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "student_summaries_delete_own"
on public.student_summaries for delete
using (owner_id = auth.uid());
