alter table public.feedbacks
  add column evidence_used_zh text[] not null default '{}'
    check (cardinality(evidence_used_zh) <= 100),
  add column evidence_used_en text[] not null default '{}'
    check (cardinality(evidence_used_en) <= 100),
  add column next_step_zh text
    check (next_step_zh is null or char_length(next_step_zh) <= 4000),
  add column next_step_en text
    check (next_step_en is null or char_length(next_step_en) <= 4000),
  add column revision bigint not null default 0 check (revision >= 0);

alter table public.feedbacks
  add constraint feedbacks_daily_record_version_key
  unique (daily_record_id, version);

create or replace function public.create_feedback_draft(
  p_owner_id uuid,
  p_daily_record_id uuid,
  p_language_mode text,
  p_content_zh text,
  p_content_en text,
  p_evidence_used_zh text[],
  p_evidence_used_en text[],
  p_next_step_zh text,
  p_next_step_en text,
  p_context_record_ids uuid[],
  p_source_feedback_id uuid,
  p_expected_revision bigint,
  p_user_message text,
  p_assistant_message text
)
returns setof public.feedbacks
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_student_id uuid;
  v_version integer;
  v_feedback public.feedbacks%rowtype;
  v_context_count integer;
begin
  if p_owner_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_daily_record_id::text, 0)
  );

  select dr.student_id
  into v_student_id
  from public.daily_records dr
  where dr.id = p_daily_record_id
    and dr.owner_id = p_owner_id;

  if v_student_id is null then
    return;
  end if;

  if p_source_feedback_id is not null then
    update public.feedbacks source_feedback
    set
      revision = source_feedback.revision + 1,
      updated_at = pg_catalog.now()
    where source_feedback.id = p_source_feedback_id
      and source_feedback.owner_id = p_owner_id
      and source_feedback.daily_record_id = p_daily_record_id
      and source_feedback.status = 'draft'
      and source_feedback.revision = p_expected_revision;

    if not found then
      return;
    end if;
  end if;

  select coalesce(max(f.version), 0) + 1
  into v_version
  from public.feedbacks f
  where f.daily_record_id = p_daily_record_id
    and f.owner_id = p_owner_id;

  insert into public.feedbacks (
    owner_id,
    student_id,
    daily_record_id,
    language_mode,
    content_zh,
    content_en,
    evidence_used_zh,
    evidence_used_en,
    next_step_zh,
    next_step_en,
    context_record_ids,
    status,
    version,
    revision
  )
  values (
    p_owner_id,
    v_student_id,
    p_daily_record_id,
    p_language_mode,
    p_content_zh,
    p_content_en,
    coalesce(p_evidence_used_zh, '{}'),
    coalesce(p_evidence_used_en, '{}'),
    p_next_step_zh,
    p_next_step_en,
    coalesce(p_context_record_ids, '{}'),
    'draft',
    v_version,
    0
  )
  returning * into v_feedback;

  if p_source_feedback_id is not null then
    insert into public.feedback_context_records (
      owner_id,
      student_id,
      feedback_id,
      daily_record_id
    )
    select
      p_owner_id,
      v_student_id,
      v_feedback.id,
      source_context.daily_record_id
    from public.feedback_context_records source_context
    where source_context.feedback_id = p_source_feedback_id
      and source_context.owner_id = p_owner_id;

    insert into public.feedback_messages (
      owner_id,
      feedback_id,
      role,
      content,
      created_at
    )
    select
      p_owner_id,
      v_feedback.id,
      source_message.role,
      source_message.content,
      source_message.created_at
    from public.feedback_messages source_message
    where source_message.feedback_id = p_source_feedback_id
      and source_message.owner_id = p_owner_id
    order by source_message.created_at, source_message.id;
  else
    insert into public.feedback_context_records (
      owner_id,
      student_id,
      feedback_id,
      daily_record_id
    )
    select
      p_owner_id,
      v_student_id,
      v_feedback.id,
      context_record.id
    from public.daily_records context_record
    where context_record.owner_id = p_owner_id
      and context_record.student_id = v_student_id
      and context_record.id = any(coalesce(p_context_record_ids, '{}'));

    get diagnostics v_context_count = row_count;
    if v_context_count <> coalesce(
      pg_catalog.cardinality(p_context_record_ids),
      0
    ) then
      raise foreign_key_violation using
        message = 'Invalid feedback context record';
    end if;
  end if;

  if p_user_message is not null then
    insert into public.feedback_messages (
      owner_id,
      feedback_id,
      role,
      content
    )
    values (p_owner_id, v_feedback.id, 'user', p_user_message);
  end if;

  if p_assistant_message is not null then
    insert into public.feedback_messages (
      owner_id,
      feedback_id,
      role,
      content
    )
    values (
      p_owner_id,
      v_feedback.id,
      'assistant',
      p_assistant_message
    );
  end if;

  return next v_feedback;
end;
$$;

revoke all on function public.create_feedback_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text,
  uuid[],
  uuid,
  bigint,
  text,
  text
) from public;
revoke all on function public.create_feedback_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text,
  uuid[],
  uuid,
  bigint,
  text,
  text
) from authenticated;
grant execute on function public.create_feedback_draft(
  uuid,
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text,
  uuid[],
  uuid,
  bigint,
  text,
  text
) to service_role;

create or replace function public.finalize_feedback(
  p_owner_id uuid,
  p_feedback_id uuid,
  p_expected_revision bigint,
  p_language_mode text,
  p_content_zh text,
  p_content_en text,
  p_evidence_used_zh text[],
  p_evidence_used_en text[],
  p_next_step_zh text,
  p_next_step_en text
)
returns table (feedback_id uuid, revision bigint)
language sql
security definer
set search_path = pg_catalog
as $$
  update public.feedbacks feedback
  set
    language_mode = p_language_mode,
    content_zh = p_content_zh,
    content_en = p_content_en,
    evidence_used_zh = coalesce(p_evidence_used_zh, '{}'),
    evidence_used_en = coalesce(p_evidence_used_en, '{}'),
    next_step_zh = p_next_step_zh,
    next_step_en = p_next_step_en,
    status = 'final',
    revision = feedback.revision + 1,
    updated_at = pg_catalog.now()
  where feedback.id = p_feedback_id
    and feedback.owner_id = p_owner_id
    and feedback.status = 'draft'
    and feedback.revision = p_expected_revision
  returning feedback.id, feedback.revision;
$$;

revoke all on function public.finalize_feedback(
  uuid,
  uuid,
  bigint,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text
) from public;
revoke all on function public.finalize_feedback(
  uuid,
  uuid,
  bigint,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text
) from authenticated;
grant execute on function public.finalize_feedback(
  uuid,
  uuid,
  bigint,
  text,
  text,
  text,
  text[],
  text[],
  text,
  text
) to service_role;
