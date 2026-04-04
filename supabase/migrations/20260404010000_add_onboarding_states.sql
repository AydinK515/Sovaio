create table if not exists public.onboarding_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  welcome_completed boolean not null default false,
  welcome_path text,
  has_export_ready boolean,
  snapshot_created boolean not null default false,
  snapshot_created_at timestamptz,
  rate_card_created boolean not null default false,
  rate_card_created_at timestamptz,
  deal_created boolean not null default false,
  deal_created_at timestamptz,
  first_negotiation_message boolean not null default false,
  first_negotiation_message_at timestamptz,
  first_channel_advisor_message boolean not null default false,
  first_channel_advisor_message_at timestamptz,
  checklist_dismissed boolean not null default false,
  route_hints_dismissed boolean not null default false,
  dismissed_hints jsonb not null default '{}'::jsonb,
  checklist_state jsonb not null default '{}'::jsonb,
  constraint onboarding_states_welcome_path_check
    check (
      welcome_path is null
      or welcome_path = any (array['price_my_channel'::text, 'negotiate_a_brand_deal'::text, 'just_exploring'::text])
    )
);

alter table public.onboarding_states enable row level security;

drop policy if exists "Users can view their own onboarding state" on public.onboarding_states;
create policy "Users can view their own onboarding state"
  on public.onboarding_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own onboarding state" on public.onboarding_states;
create policy "Users can insert their own onboarding state"
  on public.onboarding_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own onboarding state" on public.onboarding_states;
create policy "Users can update their own onboarding state"
  on public.onboarding_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_onboarding_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_states_set_updated_at on public.onboarding_states;
create trigger onboarding_states_set_updated_at
before update on public.onboarding_states
for each row
execute function public.set_onboarding_states_updated_at();
