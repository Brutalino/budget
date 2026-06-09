-- ════════════════════════════════════════════════════════════════
-- Budget Tracker — schema Supabase
-- Esegui tutto questo nell'SQL Editor del tuo progetto Supabase.
-- Crea le tabelle, attiva Row Level Security e le policy
-- (ogni utente vede solo le proprie righe).
-- ════════════════════════════════════════════════════════════════

-- ── Voci fisse ricorrenti (versione editabile di FIXED_SPESE) ──
create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  default_amt numeric not null,
  cat text not null,
  sort int default 0,
  ended_from text          -- 'YYYY-MM' = non più mostrata da quel mese in poi; null = attiva
);

-- ── Override per singolo mese di una voce fissa ──
create table if not exists fixed_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  fixed_id uuid references fixed_expenses on delete cascade,
  month text not null,            -- 'YYYY-MM'
  amt numeric,                    -- override importo; null = usa default_amt
  skipped boolean default false,  -- es. proteine non comprate questo mese
  paid boolean default false,
  unique (fixed_id, month)
);

-- ── Obiettivi / allocazioni risparmio ──
create table if not exists obiettivi (
  id bigint primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text,
  target numeric,
  saved numeric,
  monthly numeric,
  color text
);

-- ── Deposito risparmio per mese (pagato / importo depositato) ──
create table if not exists savings_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  obiettivo_id bigint references obiettivi on delete cascade,
  month text not null,     -- 'YYYY-MM'
  deposited numeric,       -- null = usa obiettivi.monthly
  paid boolean default false,
  unique (obiettivo_id, month)
);

-- ── Spese discrezionali (il widget iPhone scriverà qui) ──
create table if not exists spese (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text,
  amt numeric,
  cat text,
  date text,
  type text,
  created_at timestamptz default now()
);

-- ── Storico ──
create table if not exists log (
  id bigserial primary key,
  user_id uuid references auth.users not null default auth.uid(),
  msg text,
  ts timestamptz default now()
);

-- ════════════════════════════════════════════════════════════════
-- Row Level Security: ogni utente accede solo alle proprie righe
-- ════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['fixed_expenses','fixed_monthly','obiettivi','savings_monthly','spese','log']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($p$
      create policy "own rows %1$s" on %1$I
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    $p$, t);
  end loop;
end $$;
