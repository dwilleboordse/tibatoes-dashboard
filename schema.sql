-- ============================================================
-- TIBATOES — INTERNAL DASHBOARD
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES (extends auth.users — minimal, for ownership only)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 1. OKRs
-- ============================================================

create table if not exists okrs (
  id uuid primary key default gen_random_uuid(),
  objective text not null,
  description text,
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  owner_id uuid references profiles(id) on delete set null,
  status text not null default 'on_track'
    check (status in ('on_track', 'at_risk', 'off_track', 'achieved', 'missed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists key_results (
  id uuid primary key default gen_random_uuid(),
  okr_id uuid not null references okrs(id) on delete cascade,
  title text not null,
  unit text default '%',
  start_value numeric default 0,
  target_value numeric not null,
  current_value numeric default 0,
  direction text not null default 'max' check (direction in ('min', 'max')),
  owner_id uuid references profiles(id) on delete set null,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists key_results_okr_id_idx on key_results(okr_id);

-- ============================================================
-- 2. CALENDAR
-- ============================================================

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  end_date date,
  event_type text not null default 'general'
    check (event_type in ('general', 'launch', 'promotion', 'content', 'meeting', 'milestone')),
  color text,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists calendar_events_date_idx on calendar_events(event_date);

-- ============================================================
-- 3. CREATIVE ROADMAP
-- ============================================================

create table if not exists creative_roadmap (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'planned'
    check (status in ('planned', 'in_production', 'live', 'paused', 'killed')),
  batch_number text,
  ad_concept text not null,
  avatar text,
  mass_desire text,
  awareness_level text
    check (awareness_level in ('unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware')),
  ad_type text,
  ad_format text,
  test_result text default 'pending'
    check (test_result in ('pending', 'winner', 'loser', 'inconclusive')),
  spend numeric default 0,
  learnings text,
  creative_hit_rate numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists creative_roadmap_status_idx on creative_roadmap(status);
create index if not exists creative_roadmap_batch_idx on creative_roadmap(batch_number);

-- ============================================================
-- 4. REVENUE FORECAST (monthly rows, mirrors 2026 Calendar tab)
-- ============================================================

create table if not exists revenue_months (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),

  -- Targets
  target_revenue_pct numeric,         -- % of yearly revenue target
  target_revenue numeric,             -- monthly revenue target ($)
  target_daily_revenue numeric,
  target_spend numeric,
  target_daily_spend numeric,
  target_mer numeric,
  target_gross_profit numeric,
  target_gross_pct numeric,

  -- Actuals
  actual_revenue_pct numeric,
  actual_revenue numeric,
  actual_spend numeric,
  actual_mer numeric,
  actual_gross_profit numeric,

  -- Prior year reference
  prior_year_revenue numeric,
  prior_year_spend numeric,
  prior_year_mer numeric,
  prior_year_profit numeric,

  -- Notes
  key_events text,
  promotions text,
  winning_ads text,
  product_launches text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

-- ============================================================
-- 5. CREATORS
-- ============================================================

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  creator_name text not null,
  audience_size bigint,
  youtube_url text,
  tiktok_url text,
  instagram_url text,
  content_trends text,
  user_comment_notes text,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (any authenticated team member can read/write)
-- ============================================================

alter table profiles          enable row level security;
alter table okrs              enable row level security;
alter table key_results       enable row level security;
alter table calendar_events   enable row level security;
alter table creative_roadmap  enable row level security;
alter table revenue_months    enable row level security;
alter table creators          enable row level security;

create policy "auth read profiles"          on profiles          for select using (auth.role() = 'authenticated');
create policy "user updates own profile"    on profiles          for update using (auth.uid() = id);

create policy "auth all okrs"               on okrs              for all    using (auth.role() = 'authenticated');
create policy "auth all key_results"        on key_results       for all    using (auth.role() = 'authenticated');
create policy "auth all calendar_events"    on calendar_events   for all    using (auth.role() = 'authenticated');
create policy "auth all creative_roadmap"   on creative_roadmap  for all    using (auth.role() = 'authenticated');
create policy "auth all revenue_months"     on revenue_months    for all    using (auth.role() = 'authenticated');
create policy "auth all creators"           on creators          for all    using (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- TRIGGER: keep updated_at fresh
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','okrs','key_results','calendar_events',
      'creative_roadmap','revenue_months','creators'
    ])
  loop
    execute format('drop trigger if exists set_updated_at_%I on %I;', t, t);
    execute format(
      'create trigger set_updated_at_%I before update on %I
         for each row execute procedure set_updated_at();', t, t
    );
  end loop;
end $$;
