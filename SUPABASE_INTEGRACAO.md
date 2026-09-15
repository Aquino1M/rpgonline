# Integração com Supabase (Servidor Realtime & Banco de Dados)

O **Shadow Ascension RPG** agora conta com integração nativa com o **Supabase**, permitindo que o jogo funcione como um MMO sem precisar de servidor VPS dedicado ou Redis.

---

## 1. Dados do Projeto Configurados

- **Project URL:** `https://kfnlcrsnvckexzmhbyoy.supabase.co`
- **Publishable Key:** `sb_publishable_zB3YmZc3TNkKCHzHWQ-X5g_kKRvlkRI`
- Arquivo de configuração: `.env` e salvo nas preferências do jogo.

---

## 2. Passo Único no Painel do Supabase (Criar Tabelas)

Para que o salvamento em nuvem (Cloud Save) funcione no banco PostgreSQL:

1. Acesse o **SQL Editor** do seu projeto:
   👉 **[Abrir SQL Editor no Supabase](https://supabase.com/dashboard/project/kfnlcrsnvckexzmhbyoy/sql)**
2. Abra o arquivo [`supabase_setup.sql`](file:///supabase_setup.sql) gerado na raiz do projeto.
3. Copie todo o conteúdo e cole no editor do Supabase.
4. Clique no botão **Run** (Executar).

Pronto! As tabelas `player_profiles` e `shared_enemies` e as políticas de segurança RLS estarão criadas e ativas.

---

## 3. O que o Supabase gerencia no jogo

1. **Multiplayer em Tempo Real (Supabase Realtime):**
   - Rastreamento de jogadores conectados em `asterra-global`.
   - Sincronização contínua de posição, rotação, animações, HP e nível.
   - Propagação instantânea de ataques, habilidades, dano e morte de chefes e monstros.
   - Sistema de equipes (party) e troca de itens (trade) entre aventureiros online.

2. **Banco de Dados Persistente (Cloud Save):**
   - Salva automaticamente o nível, rank da guilda, inventário, equipamentos e progresso na tabela `player_profiles`.
   - Ao abrir o jogo em qualquer dispositivo ou navegador, seu progresso é recuperado da nuvem.

3. **Compatibilidade e Fallbacks:**
   - Se estiver sem conexão com a internet ou jogando em rede local offline, o jogo continua funcionando com o servidor WebSocket LAN (`npm run server`) ou no Vercel (`/api/multiplayer`).
