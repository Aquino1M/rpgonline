-- Security hardening for the authenticated global world.
-- Apply through Supabase SQL Editor or `supabase db push` with a project-admin session.

alter table public.player_profiles enable row level security;
revoke all on table public.player_profiles from anon;
grant select, insert, update on table public.player_profiles to authenticated;

drop policy if exists "profiles_select_own" on public.player_profiles;
drop policy if exists "profiles_insert_own" on public.player_profiles;
drop policy if exists "profiles_update_own" on public.player_profiles;

create policy "profiles_select_own" on public.player_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.player_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.player_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Realtime is authenticated and private. It carries only presence and cosmetic
-- events; progression and shared gate closure remain protected by Postgres/RPC.
drop policy if exists "shadow_ascension_realtime_read" on realtime.messages;
drop policy if exists "shadow_ascension_realtime_write" on realtime.messages;

create policy "shadow_ascension_realtime_read" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'realtime:shadow-ascension:asterra-global');

create policy "shadow_ascension_realtime_write" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'realtime:shadow-ascension:asterra-global');
