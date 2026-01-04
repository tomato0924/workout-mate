-- Create personal_goals table
create table if not exists personal_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_type text not null check (activity_type in ('running', 'swimming', 'cycling', 'treadmill', 'hiking')),
  period_type text not null check (period_type in ('weekly', 'monthly', 'yearly')),
  target_value numeric not null,
  metric_type text not null check (metric_type in ('distance', 'time')), -- 'distance' (km/m) or 'time' (seconds)
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure unique active goal per user, activity, and period
  unique(user_id, activity_type, period_type)
);

-- Enable RLS
alter table personal_goals enable row level security;

-- Policies
create policy "Users can view their own goals"
  on personal_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on personal_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on personal_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on personal_goals for delete
  using (auth.uid() = user_id);
