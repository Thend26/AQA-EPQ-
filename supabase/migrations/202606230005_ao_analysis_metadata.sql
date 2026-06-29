alter table public.document_ao_analyses
  add column if not exists model_id text not null default 'deepseek-chat'
    check (char_length(model_id) <= 100),
  add column if not exists input_hash text
    check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$'),
  add column if not exists input_summary text
    check (input_summary is null or char_length(input_summary) <= 4000);

create index if not exists document_ao_analyses_input_hash_idx
  on public.document_ao_analyses (owner_id, student_id, camp_day, input_hash, created_at desc);
