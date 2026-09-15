# Multiplayer

O lobby suportado é `asterra-global`.

- Produção: Supabase Realtime Presence + Broadcast.
- LAN/desenvolvimento: transporte local iniciado por `npm run server:lan`.
- Jogadores remotos são removidos apenas após a janela de tolerância do cliente; novos broadcasts cancelam remoções pendentes.

Configure as chaves públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de build do Vercel. Nunca use `SUPABASE_SERVICE_ROLE_KEY` no cliente.

Use `/api/multiplayer-health` após o deploy. O endpoint deve retornar `ok: true`; `supabase_env_missing` significa que as variáveis ainda não foram adicionadas no Vercel.
