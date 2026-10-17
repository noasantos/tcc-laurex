# Operação assistida, dentro do projeto existente do ChatGPT

A instalação é feita uma vez com ajuda técnica; o uso diário permanece na conversa acadêmica existente. O site oferece leitura, comentários e revisão. Exportações e troca manual de JSON não aparecem nas configurações normais. Os endpoints técnicos foram preservados para suporte, sem exigir que Laura os utilize.

## Preparação

O prompt pronto é [SETUP_PROMPT.txt](SETUP_PROMPT.txt), distribuído pelo GitHub por quem auxilia Laura. Ele não aparece no site. A interface mantém somente [MCP_REPAIR_PROMPT.txt](MCP_REPAIR_PROMPT.txt), recolhido, para recuperação de uma integração já instalada. Ele distingue acesso real ao computador de uma conversa sem terminal. Um prompt não concede ferramentas, não autentica no GitHub privado e não instala um plugin por conta própria. O operador pode ser o usuário que auxilia Laura ou um assistente local com terminal autorizado. A assinatura Pro não comprova por si só as permissões exigidas pelo túnel e pelo workspace.

Depois de npm ci e npm run build, `npm run assistant:prepare -- --allow-chatgpt-write` prepara os consentimentos locais deste único workspace, faz snapshot da mudança e grava um registro sem credenciais fora do checkout. Sem a flag explícita, não altera nada. Isso não configura a conta ChatGPT, o túnel ou permissões externas.

Configure o túnel oficial com perfil **stdio**, independente do processo do site, para permitir que o MCP inicie o site quando necessário. Use caminhos absolutos e o mesmo diretório de dados. Instale/configure o início de sessão do cliente no computador da Laura com a ajuda da versão realmente instalada. A tarefa agendada do Windows ou serviço de sessão deve iniciar o túnel sem janela de terminal; o cliente inicia o MCP stdio. Nenhuma tarefa agendada ou serviço de túnel foi instalado/testado nesta máquina como parte do desenvolvimento. Essa etapa depende das credenciais e conta de destino. Não habilite um serviço com um comando de exemplo sem validar seus caminhos e gestão de credenciais.

## Retomada

- Site parado, túnel e MCP ativos: `get_workspace_runtime` identifica o estado e `ensure_workspace_running` inicia somente o servidor conhecido desta aplicação, em loopback, sem shell ou comandos escolhidos pelo ChatGPT. Se já estiver rodando, reutiliza. Se a porta pertencer a outro app/projeto, recusa sem encerrar processos.
- Computador suspenso: não atende chamadas enquanto estiver suspenso. Após acordar, o túnel precisa reconectar.
- Computador desligado/reiniciado: só um processo local configurado no início de sessão pode restabelecer o túnel. O ChatGPT remoto não consegue chamar uma ferramenta indisponível para se recuperar sozinho.
- Túnel parado: retome o launcher/serviço local preparado pelo operador; depois valide readiness e leitura. Não reinstale nem recrie o banco.

O MCP registra logs operacionais e o servidor iniciado por ele grava `logs/workspace-runtime.log` fora do checkout. O launcher manual Abrir-Laura permanece como recurso de suporte, sem ser exigido como rotina após uma configuração automática validada.

## Contexto no projeto do ChatGPT

Coloque [PROJECT_CONTEXT.txt](PROJECT_CONTEXT.txt) nas instruções ou arquivos do **projeto já existente**. Isso não pode ser feito só escrevendo um arquivo no repositório. A instalação deve verificar na conta real a disponibilidade do plugin na conversa existente, sem presumir que instalar uma ferramenta alterou todos os chats ou que o ChatGPT lembrará de instruções nunca salvas no projeto.

## Arquivo completo quando solicitado

`create_project_archive` gera localmente um ZIP com backup validado por restauração, contendo documentos, planejamento, fontes originais, comentários, notas, versões e operações. Retorna caminho e URL local de download; não publica e não transmite o ZIP à nuvem. O ChatGPT pode orientar o download e só consegue anexá-lo na conversa se outra ferramenta efetivamente permitir essa transferência.

## Aceitação na máquina de destino

Verificar instalação única, leitura/escrita a partir da conta real, disponibilidade no chat existente, proposta recusada sem aprovação, site parado e religado pelo MCP, reinício/login do computador, suspensão/retomada e túnel interrompido. Só marcar cada cenário como validado depois de observá-lo. Testes locais de protocolo e CI Windows são evidências distintas.

Fontes oficiais consultadas em 17/10/2026: [custom MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server) e [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). A primeira descreve ferramentas de escrita sujeitas às confirmações da conta; a segunda exige cliente ativo e permissões de túnel/workspace.
