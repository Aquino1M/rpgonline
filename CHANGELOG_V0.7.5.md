# Shadow Ascension Web3D — V0.7.5

## Correção de acesso LAN / mobile

1. O launcher LAN não usa mais a faixa 8080–8099 por padrão.
2. A nova faixa padrão começa em **8765**, evitando o aplicativo que já ocupa `localhost:8080` no PC.
3. O launcher escolhe automaticamente a primeira porta livre entre 8765 e 8849.
4. O IPv4 principal prioriza a rota de rede ativa do Windows.
5. Adaptadores virtuais comuns são ignorados no fallback de IP.
6. O servidor continua fazendo bind em `0.0.0.0`, aceitando conexões por Wi-Fi/Ethernet.
7. O launcher cria uma regra de entrada no Firewall do Windows para a porta escolhida.
8. A regra aceita somente máquinas da rede local (`LocalSubnet`).
9. O launcher pode pedir UAC somente para criar a regra do Firewall.
10. O servidor inicia antes do navegador.
11. O launcher espera `/api/status` responder antes de dizer que está pronto.
12. O endereço pela interface LAN também é testado no próprio PC.
13. O navegador do PC abre o mesmo endereço LAN que deve ser usado no celular.
14. O endereço correto é salvo em `ENDERECO_DO_JOGO.txt`.
15. O console avisa explicitamente para não usar `localhost:8080`.
16. WebSocket continua na mesma porta HTTP em `/ws`.
17. `npm run server:lan` agora usa 8765 como fallback manual.
18. O servidor Node usa 8765 como porta default.
19. Foram adicionadas instruções para Guest Wi-Fi/AP Isolation e VPN.
20. Servidor atualizado para V0.7.5.
