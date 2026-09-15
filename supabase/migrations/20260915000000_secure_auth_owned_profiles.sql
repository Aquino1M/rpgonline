-- Applied to project kfnlcrsnvckexzmhbyoy on 2026-09-15.
-- Preserves legacy rows; new profiles are private to auth.users.id.

alter table public.player_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.player_profiles alter column user_id set default auth.uid();
create index if not exists player_profiles_user_id_idx on public.player_profiles(user_id);

drop policy if exists "Permitir leitura pública de perfis" on public.player_profiles;
drop policy if exists "Permitir inserção pública de perfis" on public.player_profiles;
drop policy if exists "Permitir atualização pública de perfis" on public.player_profiles;
drop policy if exists "profiles_select_own" on public.player_profiles;
drop policy if exists "profiles_insert_own" on public.player_profiles;
drop policy if exists "profiles_update_own" on public.player_profiles;

create policy "profiles_select_own" on public.player_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.player_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.player_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
