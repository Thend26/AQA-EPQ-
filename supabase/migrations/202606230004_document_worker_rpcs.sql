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

revoke all on function public.claim_document_job(text) from public;
revoke all on function public.claim_document_job(text) from authenticated;
grant execute on function public.claim_document_job(text) to service_role;

revoke all on function public.finish_document_job_success(uuid, uuid, uuid, text) from public;
revoke all on function public.finish_document_job_success(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.finish_document_job_success(uuid, uuid, uuid, text) to service_role;

revoke all on function public.finish_document_job_failure(uuid, uuid, uuid, text) from public;
revoke all on function public.finish_document_job_failure(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.finish_document_job_failure(uuid, uuid, uuid, text) to service_role;
