create table if not exists public.account_auth_limits (
  id text primary key,
  attempts integer not null check (attempts > 0),
  window_started_at timestamptz not null default now()
);

alter table public.account_auth_limits enable row level security;
revoke all on table public.account_auth_limits from anon, authenticated;
create policy "deny public account auth limits" on public.account_auth_limits
  for all to anon, authenticated using (false) with check (false);
