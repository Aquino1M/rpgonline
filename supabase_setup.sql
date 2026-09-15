-- ==========================================================
-- SHADOW ASCENSION RPG - SUPABASE SETUP
-- Cole este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ==========================================================

-- 1. TABELA DE PERFIS E PROGRESSO (CLOUD SAVE)
CREATE TABLE IF NOT EXISTS public.player_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Aventureiro',
  level INTEGER DEFAULT 1,
  guild_rank TEXT DEFAULT 'E',
  last_lobby TEXT DEFAULT 'asterra-global',
  game_data JSONB,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Política de leitura: qualquer jogador pode carregar perfis
DROP POLICY IF EXISTS "Permitir leitura pública de perfis" ON public.player_profiles;
CREATE POLICY "Permitir leitura pública de perfis" 
ON public.player_profiles 
FOR SELECT 
USING (true);

-- Política de inserção: novos jogadores podem criar seu perfil
DROP POLICY IF EXISTS "Permitir inserção pública de perfis" ON public.player_profiles;
CREATE POLICY "Permitir inserção pública de perfis" 
ON public.player_profiles 
FOR INSERT 
WITH CHECK (true);

-- Política de atualização: jogadores podem atualizar seu save
DROP POLICY IF EXISTS "Permitir atualização pública de perfis" ON public.player_profiles;
CREATE POLICY "Permitir atualização pública de perfis" 
ON public.player_profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 2. TABELA DE ESTADOS DE INIMIGOS E CHEFES COMPARTILHADOS (OPCIONAL)
CREATE TABLE IF NOT EXISTS public.shared_enemies (
  id TEXT PRIMARY KEY, -- formato: 'lobby:world:netId'
  lobby TEXT NOT NULL,
  world TEXT NOT NULL DEFAULT 'open',
  net_id TEXT NOT NULL,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  dead BOOLEAN DEFAULT false,
  respawn_at BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.shared_enemies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total shared_enemies" ON public.shared_enemies;
CREATE POLICY "Acesso total shared_enemies" 
ON public.shared_enemies 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Notificação de sucesso
SELECT 'Banco de dados configurado com sucesso para Shadow Ascension RPG!' AS status;
