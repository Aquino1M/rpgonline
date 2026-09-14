# Rede LAN / Mobile

Execute **INICIAR_SERVIDOR_LAN.bat**.

O launcher escolhe uma porta livre (normalmente 8765), faz a build, inicia o servidor, testa `/api/status`, tenta liberar o Firewall e então abre no PC o mesmo endereço que deve ser digitado no celular.

Exemplo:

`http://192.168.1.5:8765`

Não use `http://localhost:8080`: `localhost` só aponta para o próprio aparelho e, neste PC, a porta 8080 já está sendo usada por outro aplicativo.

Se o celular ainda não abrir, confirme:

- PC e celular estão no mesmo Wi-Fi/rede;
- o celular não está em uma rede "Guest/Convidados";
- o roteador não está com AP/Client Isolation ativado;
- VPN está desligada temporariamente no PC e no celular;
- a janela do servidor continua aberta;
- a janela do UAC do Firewall foi aceita.

O endereço da execução atual também fica salvo em `ENDERECO_DO_JOGO.txt`.
