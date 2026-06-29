drop function if exists public.save_daily_record(
  uuid,
  uuid,
  date,
  integer,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  bigint
);

create or replace function public.save_daily_record(
  p_owner_id uuid,
  p_student_id uuid,
  p_record_date date,
  p_achievements text,
  p_evidence text,
  p_challenges text,
  p_next_plan text,
  p_process_notes text,
  p_behavior_tags text[],
  p_ao1_note text,
  p_ao2_note text,
  p_ao3_note text,
  p_ao4_note text,
  p_expected_revision bigint
)
returns setof public.daily_records
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_camp_start_date date;
  v_camp_day integer;
  v_record public.daily_records%rowtype;
begin
  if p_owner_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_owner_id::text || ':' || p_student_id::text || ':' || p_record_date::text,
      0
    )
  );

  select student.camp_start_date
    into v_camp_start_date
  from public.students student
  where student.id = p_student_id
    and student.owner_id = p_owner_id
  for share;

  if not found then
    return;
  end if;

  v_camp_day := p_record_date - v_camp_start_date + 1;

  if v_camp_day < 1 then
    raise exception 'record date before camp start'
      using errcode = 'PDR01';
  end if;

  if v_camp_day > 100 then
    raise exception 'record date outside supported camp range'
      using errcode = 'PDR02';
  end if;

  if p_expected_revision is null then
    if exists (
      select 1
      from public.daily_records daily_record
      where daily_record.owner_id = p_owner_id
        and daily_record.student_id = p_student_id
        and daily_record.record_date = p_record_date
    ) then
      return;
    end if;

    insert into public.daily_records (
      owner_id,
      student_id,
      record_date,
      camp_day,
      achievements,
      evidence,
      challenges,
      next_plan,
      process_notes,
      behavior_tags,
      ao1_note,
      ao2_note,
      ao3_note,
      ao4_note,
      revision
    )
    values (
      p_owner_id,
      p_student_id,
      p_record_date,
      v_camp_day,
      p_achievements,
      coalesce(p_evidence, ''),
      coalesce(p_challenges, ''),
      p_next_plan,
      coalesce(p_process_notes, ''),
      coalesce(p_behavior_tags, '{}'),
      coalesce(p_ao1_note, ''),
      coalesce(p_ao2_note, ''),
      coalesce(p_ao3_note, ''),
      coalesce(p_ao4_note, ''),
      0
    )
    returning * into v_record;
  else
    update public.daily_records daily_record
    set
      camp_day = v_camp_day,
      achievements = p_achievements,
      evidence = coalesce(p_evidence, ''),
      challenges = coalesce(p_challenges, ''),
      next_plan = p_next_plan,
      process_notes = coalesce(p_process_notes, ''),
      behavior_tags = coalesce(p_behavior_tags, '{}'),
      ao1_note = coalesce(p_ao1_note, ''),
      ao2_note = coalesce(p_ao2_note, ''),
      ao3_note = coalesce(p_ao3_note, ''),
      ao4_note = coalesce(p_ao4_note, ''),
      revision = daily_record.revision + 1,
      updated_at = pg_catalog.now()
    where daily_record.owner_id = p_owner_id
      and daily_record.student_id = p_student_id
      and daily_record.record_date = p_record_date
      and daily_record.revision = p_expected_revision
    returning * into v_record;

    if not found then
      return;
    end if;
  end if;

  return next v_record;
end;
$$;

revoke all on function public.save_daily_record(
  uuid,
  uuid,
  date,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  bigint
) from public;
revoke all on function public.save_daily_record(
  uuid,
  uuid,
  date,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  bigint
) from authenticated;
grant execute on function public.save_daily_record(
  uuid,
  uuid,
  date,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  bigint
) to service_role;

create or replace function public.prevent_camp_start_date_conflicts()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.camp_start_date is not distinct from new.camp_start_date then
    return new;
  end if;

  if exists (
    select 1
    from public.daily_records daily_record
    where daily_record.owner_id = old.owner_id
      and daily_record.student_id = old.id
  ) then
    raise exception 'Camp start date conflicts with existing records or documents'
      using errcode = 'PSC01';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_camp_start_date_conflicts
  on public.students;
create trigger prevent_camp_start_date_conflicts
  before update of camp_start_date on public.students
  for each row
  execute function public.prevent_camp_start_date_conflicts();
