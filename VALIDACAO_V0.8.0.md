# Validação V0.8.0

## Testes executados

- `node --check` em todos os módulos JS de `src/game/` e em `server/server.js`: **OK**.
- Parse/checagem JSX de `App.jsx`, `Minimap.jsx` e `WorldMap.jsx` via TypeScript: **OK**.
- Balanceamento estrutural do CSS: **OK**.
- Smoke test de configuração: **8 cidades, 8 economias, 8 zonas, 10 aventureiros IA e 19 ranks**: **OK**.
- Spawn Aurora verificado fora do raio do poço: **OK**.
- Estoques de todas as cidades testados com jogador Nv.300; nenhum item de gear escapou da faixa min/max da zona: **OK**.
- Drop regional Aurora verificado como `Essência Lúmen`: **OK**.
- Configuração de respawn normal/boss/IA carregada corretamente: **OK**.

## Bug encontrado durante a validação

A primeira implementação permitia ocasionalmente item Nv.11 na Cidadela Aurora (faixa Nv.1–10). O clamp usava 300 como teto. Foi corrigido para usar `zoneMax`.

## Limitação deste ambiente

A build Vite completa não foi executada aqui porque esta cópia não contém `node_modules` e o ambiente não possui acesso confiável à instalação npm. O launcher Windows continua responsável por `npm install`/build quando necessário.

## GitHub

O código está preparado para `Aquino1M/RPG`. O conector GitHub desta conversa retornou `FORBIDDEN: This conversation is restricted to developer MCPs`, portanto o push remoto não pôde ser concluído pelo assistente. O arquivo `PUBLICAR_GITHUB_RPG.bat` foi incluído como rota segura, sem `--force`.
