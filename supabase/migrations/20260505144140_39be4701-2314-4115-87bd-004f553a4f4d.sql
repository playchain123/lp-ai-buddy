create table if not exists public.telegram_rebalance_intents (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  wallet text not null,
  action text not null check (action in ('zap_in','zap_out')),
  pool_id text,
  position_id text,
  amount_sol numeric,
  bps integer,
  strategy text not null default 'Spot',
  output text not null default 'allBaseToken',
  quote jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','expired','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists idx_telegram_rebalance_chat_status
  on public.telegram_rebalance_intents(chat_id, status, expires_at desc);

alter table public.telegram_rebalance_intents enable row level security;