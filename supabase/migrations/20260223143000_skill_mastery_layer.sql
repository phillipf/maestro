-- Skill Mastery Layer schema (v1)

create table if not exists public.skill_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outcome_id uuid not null references public.outcomes(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 240),
  stage text not null default 'active' check (stage in ('active', 'review', 'archived')),
  target_label text,
  target_value numeric,
  initial_confidence integer not null default 1 check (initial_confidence between 1 and 5),
  graduation_suppressed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint skill_target_fields_together check ((target_label is null) = (target_value is null)),
  constraint skill_target_value_positive check (target_value is null or target_value > 0)
);

create table if not exists public.skill_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_item_id uuid not null references public.skill_items(id) on delete cascade,
  action_log_id uuid references public.action_logs(id) on delete set null,
  confidence integer not null check (confidence between 1 and 5),
  target_result numeric,
  logged_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists skill_items_user_outcome_stage_idx
  on public.skill_items (user_id, outcome_id, stage);

create unique index if not exists skill_items_outcome_name_live_unique_idx
  on public.skill_items (outcome_id, lower(trim(name)))
  where stage in ('active', 'review');

create index if not exists skill_logs_user_skill_logged_idx
  on public.skill_logs (user_id, skill_item_id, logged_at desc);

create index if not exists skill_logs_action_log_idx
  on public.skill_logs (action_log_id);

create unique index if not exists skill_logs_skill_action_unique_idx
  on public.skill_logs (skill_item_id, action_log_id)
  where action_log_id is not null;

create trigger set_skill_items_updated_at
before update on public.skill_items
for each row execute function public.set_updated_at();

create trigger set_skill_logs_updated_at
before update on public.skill_logs
for each row execute function public.set_updated_at();

create trigger enforce_skill_items_owner
before insert on public.skill_items
for each row execute function public.enforce_user_ownership();

create trigger enforce_skill_logs_owner
before insert on public.skill_logs
for each row execute function public.enforce_user_ownership();

alter table public.skill_items enable row level security;
alter table public.skill_logs enable row level security;

create policy skill_items_owner on public.skill_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy skill_logs_owner on public.skill_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
