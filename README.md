# Shadow Ascension

RPG 3D em React, Vite e Three.js. Possui mundo aberto, progressão, masmorras, multiplayer e controles para PC, celular e tablet.

## Rodar

```bash
npm install
npm run dev
npm run build
```

Para LAN, use `npm run server:lan`. O cliente de produção é publicado a partir da branch `main` no GitHub/Vercel.

## Controles

- PC: WASD, Espaço, Ctrl, Shift, E, R, H e 1/2/3.
- Touch: joystick, atacar, defesa, esquiva, correr por toque contínuo, pular e habilidades.

## Documentação atual

- [Supabase e contas](SUPABASE_INTEGRACAO.md)
- [Multiplayer](MULTIPLAYER.md)
- [Masmorras](DUNGEON_SYSTEM.md)
- [Progressão](LEVELING_SYSTEM.md)
- [Importação de assets](PACK_E_PACK2_INTEGRACAO.md)
- [Histórico resumido](CHANGELOG.md)

## Diagnóstico

`GET /api/multiplayer-health` valida a configuração de Supabase da função Vercel. Erros do cliente ficam no `localStorage` em `shadow-ascension-client-errors-v1`.
