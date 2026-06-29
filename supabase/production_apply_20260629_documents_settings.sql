-- Production patch for the EPQ Camp Companion documents/settings release.
-- Safe to rerun: objects are created with IF NOT EXISTS or guarded by catalog checks.

create table if not exists public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  theme_preset text not null default 'professional'
    check (theme_preset in ('professional', 'ocean', 'sunrise', 'forest', 'custom')),
  custom_primary text,
  custom_accent text,
  font_scale text not null default 'medium'
    check (font_scale in ('small', 'medium', 'large')),
  font_weight text not null default 'medium'
    check (font_weight in ('regular', 'medium', 'bold')),
  deepseek_model text not null default 'chat'
    check (deepseek_model in ('chat', 'reason', 'v4-pro')),
  deepseek_key_ciphertext text,
  deepseek_key_iv text,
  deepseek_key_tag text,
  deepseek_key_last4 text,
  deepseek_key_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'Users can read own settings'
  ) then
    create policy "Users can read own settings"
      on public.user_settings
      for select
      using (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'Users can insert own settings'
  ) then
    create policy "Users can insert own settings"
      on public.user_settings
      for insert
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'Users can update own settings'
  ) then
    create policy "Users can update own settings"
      on public.user_settings
      for update
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;
end $$;

insert into public.user_settings (owner_id)
select id
from auth.users
on conflict (owner_id) do nothing;

create or replace function public.create_default_user_settings()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.user_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_default_user_settings on auth.users;
create trigger create_default_user_settings
  after insert on auth.users
  for each row
  execute function public.create_default_user_settings();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null,
  camp_day integer not null check (camp_day between 1 and 100),
  original_filename text not null
    check (btrim(original_filename) <> '' and char_length(original_filename) <= 255),
  storage_path text not null
    check (btrim(storage_path) <> '' and char_length(storage_path) <= 1024),
  mime_type text not null check (char_length(mime_type) <= 200),
  byte_size bigint not null check (byte_size between 1 and 26214400),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{3,128}$'),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'queued', 'processing', 'extracted', 'failed', 'deleted')),
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 200000),
  extraction_error text check (extraction_error is null or char_length(extraction_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_documents_id_owner_key unique (id, owner_id),
  constraint student_documents_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade,
  unique (owner_id, storage_path),
  unique (owner_id, student_id, sha256)
);

create table if not exists public.document_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_jobs_document_owner_fk
    foreign key (document_id, owner_id)
    references public.student_documents (id, owner_id)
    on delete cascade,
  unique (owner_id, document_id)
);

create table if not exists public.document_ao_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null,
  document_id uuid references public.student_documents(id) on delete set null,
  camp_day integer not null check (camp_day between 1 and 100),
  ao1_note text not null default '' check (char_length(ao1_note) <= 4000),
  ao2_note text not null default '' check (char_length(ao2_note) <= 4000),
  ao3_note text not null default '' check (char_length(ao3_note) <= 4000),
  ao4_note text not null default '' check (char_length(ao4_note) <= 4000),
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_ao_analyses_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade
);

alter table public.student_documents enable row level security;
alter table public.document_jobs enable row level security;
alter table public.document_ao_analyses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_documents'
      and policyname = 'Users can read own student documents'
  ) then
    create policy "Users can read own student documents"
      on public.student_documents
      for select
      using (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_documents'
      and policyname = 'Users can insert own student documents'
  ) then
    create policy "Users can insert own student documents"
      on public.student_documents
      for insert
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_documents'
      and policyname = 'Users can update own student documents'
  ) then
    create policy "Users can update own student documents"
      on public.student_documents
      for update
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_jobs'
      and policyname = 'Users can read own document jobs'
  ) then
    create policy "Users can read own document jobs"
      on public.document_jobs
      for select
      using (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_ao_analyses'
      and policyname = 'Users can read own document AO analyses'
  ) then
    create policy "Users can read own document AO analyses"
      on public.document_ao_analyses
      for select
      using (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_ao_analyses'
      and policyname = 'Users can insert own document AO analyses'
  ) then
    create policy "Users can insert own document AO analyses"
      on public.document_ao_analyses
      for insert
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_ao_analyses'
      and policyname = 'Users can update own document AO analyses'
  ) then
    create policy "Users can update own document AO analyses"
      on public.document_ao_analyses
      for update
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read own stored documents'
  ) then
    create policy "Users can read own stored documents"
      on storage.objects
      for select
      using (
        bucket_id = 'student-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own stored documents'
  ) then
    create policy "Users can upload own stored documents"
      on storage.objects
      for insert
      with check (
        bucket_id = 'student-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own stored documents'
  ) then
    create policy "Users can update own stored documents"
      on storage.objects
      for update
      using (
        bucket_id = 'student-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'student-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

create index if not exists student_documents_owner_student_idx
  on public.student_documents (owner_id, student_id, camp_day, created_at desc);
create index if not exists document_jobs_status_idx
  on public.document_jobs (status, locked_at, created_at);
create index if not exists document_ao_analyses_owner_student_idx
  on public.document_ao_analyses (owner_id, student_id, camp_day, created_at desc);

create or replace function public.mark_student_document_deleted(
  p_owner_id uuid,
  p_document_id uuid
)
returns setof public.student_documents
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_document public.student_documents%rowtype;
begin
  update public.student_documents document
  set status = 'deleted',
      updated_at = pg_catalog.now()
  where document.owner_id = p_owner_id
    and document.id = p_document_id
    and document.status <> 'deleted'
  returning * into v_document;

  if found then
    return next v_document;
  end if;
end;
$$;

create or replace function public.claim_document_job(
  p_worker_id text
)
returns table (
  job_id uuid,
  owner_id uuid,
  document_id uuid,
  storage_path text,
  mime_type text,
  original_filename text,
  attempts integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.document_jobs%rowtype;
begin
  select job.*
  into v_job
  from public.document_jobs job
  join public.student_documents document
    on document.id = job.document_id
   and document.owner_id = job.owner_id
  where job.status in ('queued', 'failed')
    and document.status in ('uploaded', 'queued', 'failed')
    and job.attempts < 5
  order by job.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.document_jobs job
  set status = 'processing',
      attempts = job.attempts + 1,
      last_error = null,
      locked_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where job.id = v_job.id
  returning * into v_job;

  update public.student_documents document
  set status = 'processing',
      extraction_error = null,
      updated_at = pg_catalog.now()
  where document.id = v_job.document_id
    and document.owner_id = v_job.owner_id
    and document.status <> 'deleted';

  return query
  select
    v_job.id as job_id,
    document.owner_id,
    document.id as document_id,
    document.storage_path,
    document.mime_type,
    document.original_filename,
    v_job.attempts
  from public.student_documents document
  where document.id = v_job.document_id
    and document.owner_id = v_job.owner_id;
end;
$$;

create or replace function public.finish_document_job_success(
  p_job_id uuid,
  p_owner_id uuid,
  p_document_id uuid,
  p_extracted_text text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.student_documents document
  set status = 'extracted',
      extracted_text = pg_catalog.left(p_extracted_text, 200000),
      extraction_error = null,
      updated_at = pg_catalog.now()
  where document.id = p_document_id
    and document.owner_id = p_owner_id
    and document.status <> 'deleted';

  update public.document_jobs job
  set status = 'succeeded',
      last_error = null,
      locked_at = null,
      updated_at = pg_catalog.now()
  where job.id = p_job_id
    and job.owner_id = p_owner_id
    and job.document_id = p_document_id;
end;
$$;

create or replace function public.finish_document_job_failure(
  p_job_id uuid,
  p_owner_id uuid,
  p_document_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.student_documents document
  set status = 'failed',
      extraction_error = pg_catalog.left(p_error, 2000),
      updated_at = pg_catalog.now()
  where document.id = p_document_id
    and document.owner_id = p_owner_id
    and document.status <> 'deleted';

  update public.document_jobs job
  set status = 'failed',
      last_error = pg_catalog.left(p_error, 2000),
      locked_at = null,
      updated_at = pg_catalog.now()
  where job.id = p_job_id
    and job.owner_id = p_owner_id
    and job.document_id = p_document_id;
end;
$$;

revoke all on function public.mark_student_document_deleted(uuid, uuid) from public;
revoke all on function public.mark_student_document_deleted(uuid, uuid) from authenticated;
grant execute on function public.mark_student_document_deleted(uuid, uuid) to service_role;

revoke all on function public.claim_document_job(text) from public;
revoke all on function public.claim_document_job(text) from authenticated;
grant execute on function public.claim_document_job(text) to service_role;

revoke all on function public.finish_document_job_success(uuid, uuid, uuid, text) from public;
revoke all on function public.finish_document_job_success(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.finish_document_job_success(uuid, uuid, uuid, text) to service_role;

revoke all on function public.finish_document_job_failure(uuid, uuid, uuid, text) from public;
revoke all on function public.finish_document_job_failure(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.finish_document_job_failure(uuid, uuid, uuid, text) to service_role;

alter table public.document_ao_analyses
  add column if not exists model_id text not null default 'deepseek-chat'
    check (char_length(model_id) <= 100),
  add column if not exists input_hash text
    check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$'),
  add column if not exists input_summary text
    check (input_summary is null or char_length(input_summary) <= 4000);

create index if not exists document_ao_analyses_input_hash_idx
  on public.document_ao_analyses (owner_id, student_id, camp_day, input_hash, created_at desc);

notify pgrst, 'reload schema';
