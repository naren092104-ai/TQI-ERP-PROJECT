create table if not exists public.operational_backups (
  id text primary key,
  kind text not null check (kind in ('manual','automatic','pre-reset')),
  created_at timestamptz not null default now(),
  created_by text,
  counts jsonb not null default '{}'::jsonb,
  checksum text,
  includes_uploads boolean not null default false,
  status text not null default 'READY',
  snapshot jsonb not null default '{}'::jsonb
);
create index if not exists idx_operational_backups_created on public.operational_backups(created_at desc);

alter table public.operational_backups enable row level security;
