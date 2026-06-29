create table public.user_settings (
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

create policy "Users can read own settings"
  on public.user_settings
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert own settings"
  on public.user_settings
  for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own settings"
  on public.user_settings
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

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
