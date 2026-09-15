-- Shadow Ascension — reset one-time de contas/perfis de teste
-- Execute manualmente no Supabase SQL Editor. NÃO é executado automaticamente pelo site.
-- shared_enemies é preservada.

begin;

select count(*) as player_profiles_antes
from public.player_profiles;

truncate table public.player_profiles restart identity;

select count(*) as player_profiles_depois
from public.player_profiles;

commit;
