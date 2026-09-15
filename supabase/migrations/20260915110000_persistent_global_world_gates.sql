-- Durable shared state for deterministic 30-minute global gate cycles.
-- Apply with the Supabase CLI or SQL Editor using a project-admin session.

create table if not exists public.world_gate_cycles (
  cycle bigint primary key check (cycle > 0),
  closed_gate_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.world_gate_cycles enable row level security;
revoke all on table public.world_gate_cycles from anon, authenticated;
grant select on table public.world_gate_cycles to authenticated;

drop policy if exists "world_gate_cycles_select_authenticated" on public.world_gate_cycles;
create policy "world_gate_cycles_select_authenticated"
  on public.world_gate_cycles for select to authenticated
  using ((select auth.uid()) is not null);

create or replace function public.close_world_gate(p_cycle bigint, p_gate_id text)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  gate_ids text[];
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;
  if p_cycle <> floor(extract(epoch from now()) / 1800)::bigint then
    raise exception 'invalid gate cycle';
  end if;
  if p_gate_id !~ ('^global-gate-' || p_cycle::text || '-[0-3]$') then
    raise exception 'invalid gate id';
  end if;

  insert into public.world_gate_cycles as gates (cycle, closed_gate_ids)
  values (p_cycle, array[p_gate_id])
  on conflict (cycle) do update set
    closed_gate_ids = case
      when p_gate_id = any(gates.closed_gate_ids) then gates.closed_gate_ids
      else array_append(gates.closed_gate_ids, p_gate_id)
    end,
    updated_at = now()
  returning closed_gate_ids into gate_ids;

  return gate_ids;
end;
$$;

revoke all on function public.close_world_gate(bigint, text) from public, anon;
grant execute on function public.close_world_gate(bigint, text) to authenticated;
