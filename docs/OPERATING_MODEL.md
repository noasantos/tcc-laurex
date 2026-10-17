# Operação com Codex local

Laura usa sua conversa no Codex instalado no computador. O site é a interface de leitura, comentários e aprovação. O MCP é um processo stdio local iniciado pelo Codex; não depende de túnel, conta Platform ou porta pública. O modelo do Codex continua dependendo da conexão normal do próprio produto à OpenAI; local refere-se ao servidor, às ferramentas e ao armazenamento, não a um modelo offline.

## Instalação única

Execute Configurar-Windows.cmd ou Configurar.command. Depois de instalar dependências e gerar a interface, o configurador executa `npm run assistant:connect -- --allow-local-write`, registra `laura-workspace` pelo comando oficial `codex mcp add`, habilita leitura/escrita deste workspace com backup anterior quando necessário e testa get_project_info por um cliente MCP real. Caminhos são absolutos e dados permanecem fora do checkout. O registro sem credenciais fica em `setup/codex.json` na pasta de dados.

É necessário Codex local instalado. O script procura a CLI no ambiente, no PATH e nas localizações conhecidas do aplicativo macOS. No Windows reconhece o executável e a instalação npm oficial. Se não a encontrar, informa como instalar a CLI oficial; não declara sucesso nem configura um túnel como alternativa. O registro é restrito ao nome laura-workspace e recusa substituir uma conexão que aponta para outra pasta de dados.

O prompt distribuído pelo GitHub está em [SETUP_PROMPT.txt](SETUP_PROMPT.txt). O site oferece [MCP_REPAIR_PROMPT.txt](MCP_REPAIR_PROMPT.txt) como suporte. Reexecutar a conexão não cria um novo projeto nem novas conversas e não altera conteúdo acadêmico. Se a conexão MCP foi revogada, Abrir-Laura não a reabilita; executar novamente o configurador com sua autorização volta a habilitá-la.

## Uso diário

Retome a mesma conversa no Codex e peça “Abra meu Laura Workspace e consulte o projeto pelo MCP”. get_workspace_runtime verifica o site e ensure_workspace_running inicia o servidor conhecido em loopback quando necessário. Não encerra processos de outros projetos. O servidor roda separado do terminal e grava seu log na pasta de dados. Abrir-Laura.cmd ou Abrir-Laura.command também abre o site e pode ter a janela fechada depois de iniciar.

O Codex carrega a configuração MCP ao iniciar sua conexão. Se foi registrado durante uma conversa que não recebeu as ferramentas, reabra o Codex e retome essa conversa uma vez. Não se promete atualizar ferramentas de uma sessão já carregada. Após reiniciar o computador, abrir o Codex volta a disponibilizar o MCP; o site pode então ser iniciado por ele. Não é necessário instalar serviço de túnel ou tarefa agendada. Não há atendimento enquanto o computador estiver desligado ou suspenso.

A orientação acadêmica está em [PROJECT_CONTEXT.txt](PROJECT_CONTEXT.txt); leia-a na conversa local sem inventar importação de históricos de outros produtos. Aprovação de propostas e confirmação de conclusão com comentários abertos continuam exclusivamente locais.

## Evidências

O configurador prova registro e comunicação stdio com o projeto correto. Isso é diferente de observar uma chamada feita pela conversa já aberta. Valide as duas coisas na instalação de destino. npm run mcp:poc usa dados temporários para leitura/escrita e bloqueios. CI Windows é diferente de instalação no PC da Laura.

O antigo cenário de ChatGPT web com túnel está documentado em [MCP.md](MCP.md) somente como alternativa remota, fora da instalação padrão. A documentação oficial da configuração local está em https://developers.openai.com/codex/mcp/.
