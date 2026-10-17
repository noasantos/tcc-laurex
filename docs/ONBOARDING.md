# Apresentação inicial do LAUREX

A apresentação usa Driver.js instalado por npm e incluído no bundle local. Nenhum recurso remoto, telemetria ou conteúdo acadêmico de demonstração é carregado.

## Reconhecimento local durável

`local_onboarding`, no `workspace.sqlite` dentro de `LAURA_DATA_DIR`, é a fonte de autoridade. O banco já usa WAL, `synchronous=FULL` e tempo de espera para bloqueios. A tabela representa o único espaço local deste diretório de dados, independentemente do ID restaurado de um arquivo acadêmico. O modelo v1 contém revisão própria, setup (`pending`, `import`, `ready`), estado (`not_started`, `in_progress`, `completed`, `dismissed`), ID estável do último passo e dispensas individuais das dicas.

Apagar cookies e armazenamento do navegador, mudar a porta localhost ou reiniciar navegador, servidor e computador não altera esse reconhecimento se o mesmo diretório de dados for mantido. Um diretório genuinamente novo é uma instalação nova. Os testes reiniciam o servidor e criam contextos novos do navegador em outra porta; não simulam um reboot físico.

Os metadados não fazem parte do JSON acadêmico, de suas revisões, versões, exportações ou restaurações. Restaurar uma versão ou backup acadêmico no mesmo diretório não restaura a apresentação. Um backup acadêmico importado em um diretório novo recebe uma nova apresentação. Para transportar também o reconhecimento da instalação, preserve o diretório local completo com o aplicativo encerrado.

Uma instalação anterior sem metadados recebe convite único. Um projeto já estabelecido (histórico de conteúdo acadêmico ou nome definido) pula o setup, mas não pula o convite. Autorizar o MCP, por si só, não pula o setup acadêmico. A antiga flag `laura-welcome` não comprova conclusão. Projetos vazios novos podem encerrar o setup sem criar capítulos; a rota de importação é persistida e requer conclusão ou cancelamento explícito.

## Concorrência e falhas

`GET /api/onboarding` não é cacheado. `POST /api/onboarding` aceita eventos limitados e `expectedRevision` da própria apresentação. Usa transação `BEGIN IMMEDIATE` e comparação de revisão. Uma atualização desatualizada recebe 409; a interface relê o estado e encerra a tentativa, sem repetir uma escrita contra a nova revisão. Conclusão ou dispensa não pode ser regredida por progresso; replay mantém o estado terminal. Cada passo e dispensa é gravado imediatamente, sem depender de encerramento ou `beforeunload`.

Os endpoints herdam as proteções de Host, Origin, Fetch Metadata e token de sessão da UI. Não são ações de domínio nem ferramentas MCP. Erros de leitura/escrita não retornam valores padrão de primeira visita: exibem aviso e preservam o acesso aos documentos.

Escape e clique fora interrompem a apresentação; no próximo carregamento há uma escolha discreta de retomada. “Pular tour” e “Agora não” dispensam o convite. “Fazer tour novamente”, em Configurações, começa no primeiro passo sem remover a conclusão/dispensa anterior. Nenhuma transição avança por temporizador.

## Integração e acessibilidade

Os alvos usam `data-tour` explícito. O controlador aguarda montagem e visibilidade pelo ciclo de renderização, com limite de falha de seis segundos. Um alvo ausente encerra a apresentação com aviso. A navegação abre temporariamente, inclusive em janela estreita, sem alterar a preferência de fixação; Escape durante o tour também preserva essa preferência. O passo de revisões usa a entrada sempre disponível “Visão geral”, que abre o resumo existente, evitando criar propostas ou depender da navegação condicional.

O editor aberto permanece montado durante os passos seguintes. Foco, seleção existente e posições de rolagem dos painéis são capturados e restaurados quando possível. Setup, importação, recuperação, erros, rascunhos e formulários em edição bloqueiam o tour. As dicas são independentes, uma por vez, e dependem de controles reais visíveis. A dica da barra de seleção não captura foco; referência só é copiada pelo clique explícito no controle existente. Planejamento pode mostrar sua dica no painel lateral; a apresentação principal aguarda seu fechamento.

Todos os textos novos são em português. Os popovers acompanham os tokens de tema locais, têm foco visível, ações por teclado, retorno de foco e animação desativada. Não há prova de conexão com uma conta ChatGPT nesta implementação.

## Verificação

- `npm run build`
- `npm test` (inclui testes de SQLite, HTTP e navegador)
- `npm run mcp:poc`

O teste de navegador requer build existente e Chromium do Playwright (`npx playwright install chromium`); se o runtime estiver ausente, informa explicitamente que essa camada foi pulada. Usa diretório de dados descartável fora do checkout, dois servidores/portas e dois contextos sem armazenamento compartilhado. Exercita setup/importação cancelada, projeto vazio, retomada, conclusão, replay repetido, comentários por seleção, edição persistida, dicas de modos/referência/planejamento/proposta, temas, teclado e janela estreita. Capturas de inspeção são regeneráveis e ficam em `/tmp/laurex-tour-*.png`, fora do checkout.
