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

create table public.student_documents (
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
  constraint student_documents_student_owner_fk
    foreign key (student_id, owner_id)
    references public.students (id, owner_id)
    on delete cascade,
  unique (owner_id, storage_path),
  unique (owner_id, student_id, sha256)
);

create table public.document_jobs (
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
    on delete cascade
);

create table public.document_ao_analyses (
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

create policy "Users can read own student documents"
  on public.student_documents
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert own student documents"
  on public.student_documents
  for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own student documents"
  on public.student_documents
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can read own document jobs"
  on public.document_jobs
  for select
  using (auth.uid() = owner_id);

create policy "Users can read own document AO analyses"
  on public.document_ao_analyses
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert own document AO analyses"
  on public.document_ao_analyses
  for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own document AO analyses"
  on public.document_ao_analyses
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can read own stored documents"
  on storage.objects
  for select
  using (
    bucket_id = 'student-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload own stored documents"
  on storage.objects
  for insert
  with check (
    bucket_id = 'student-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

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

create index student_documents_owner_student_idx
  on public.student_documents (owner_id, student_id, camp_day, created_at desc);
create index document_jobs_status_idx
  on public.document_jobs (status, locked_at, created_at);
create index document_ao_analyses_owner_student_idx
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

revoke all on function public.mark_student_document_deleted(uuid, uuid) from public;
revoke all on function public.mark_student_document_deleted(uuid, uuid) from authenticated;
grant execute on function public.mark_student_document_deleted(uuid, uuid) to service_role;
