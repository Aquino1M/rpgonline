# Supabase: autenticação e save

O jogo usa Supabase Auth para login com e-mail e senha. O perfil do jogador é salvo em `public.player_profiles`, protegido para que somente o proprietário autenticado leia ou altere seu próprio save.

## Configuração

1. Em **Auth > Providers**, habilite e-mail/senha.
2. Em **Auth > URL Configuration**, adicione `https://rpgonline-orpin.vercel.app` como Site URL e Redirect URL.
3. No Vercel, configure para Production e Preview:

```text
VITE_SUPABASE_URL=https://kfnlcrsnvckexzmhbyoy.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

4. Faça redeploy e confirme `GET /api/multiplayer-health` com `ok: true`.

Use somente a chave pública no Vite. `service_role` nunca deve entrar em `.env`, Git, Vercel client-side ou browser.

## Banco

A migração `supabase/migrations/20260915000000_secure_auth_owned_profiles.sql` foi aplicada ao projeto. Para um projeto novo, execute `supabase_setup.sql` no SQL Editor.

Os 9 perfis anteriores foram preservados, mas não possuem vínculo com `auth.users`; portanto não são expostos a novas contas. Vinculação de um save legado exige uma decisão administrativa por usuário, para evitar que um jogador reivindique o progresso de outro.
