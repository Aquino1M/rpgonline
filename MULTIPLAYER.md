# Multiplayer e Autenticação Supabase

Documentação de infraestrutura de rede, persistência de contas e sincronização em tempo real de **Shadow Ascension**.

---

## 1. Arquitetura de Rede

O multiplayer opera com suporte primário a **Supabase Realtime** (Presence + Broadcast) e fallback serverless/WebSocket:
- **Lobby Global**: `asterra-global` (canal `realtime:shadow-ascension:asterra-global`).
- **Sincronização de Jogadores**:
  - `Presence`: Rastreamento contínuo de entrada e saída de jogadores com tolerância a oscilações de rede.
  - `Broadcast`: Posicionamento contínuo (20 pacotes/segundo), rotação, animações, golpes de combate e uso de habilidades.
  - `Equipe / Party`: Troca de XP compartilhado entre membros próximos no mesmo mundo.

---

## 2. Autenticação e Salvamento na Nuvem

- **Autenticação**: Supabase Auth (e-mail e senha).
- **Tabela de Perfis**: `public.player_profiles`
  - Protegida por **Row Level Security (RLS)**: Cada jogador só tem permissão de leitura e escrita sobre seu próprio registro vinculado ao seu `auth.uid()`.
  - O save contém nível, atributos, ouro, inventário, equipamentos e progresso da guilda.

---

## 3. Variáveis de Ambiente e Configuração

No ambiente do Vercel ou arquivo `.env`:

```env
VITE_SUPABASE_URL=https://kfnlcrsnvckexzmhbyoy.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_publica
```

> [!IMPORTANT]
> Use apenas a chave anônima pública (`anon / publishable key`). A chave mestra `service_role` **nunca** deve ser inserida no frontend, commits ou repositórios públicos.

---

## 4. Diagnóstico de Saúde

Após o deploy ou em desenvolvimento local, acesse:
```http
GET /api/multiplayer-health
```
Resposta esperada em caso de sucesso:
```json
{
  "ok": true,
  "mode": "supabase-realtime",
  "room": "asterra-global",
  "urlConfigured": true,
  "publicKeyConfigured": true,
  "restReachable": true,
  "status": 200
}
```
Se retornar `supabase_env_missing`, as variáveis de ambiente ainda não foram preenchidas no painel de hospedagem.
