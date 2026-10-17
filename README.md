# Laura Workspace

Um ambiente local para organizar e revisar o TCC com o ChatGPT como colaborador de escrita. Sem chat próprio, hospedagem, banco remoto ou API de geração de texto.

## Começar pelo Codex

Abra uma conversa no **Codex local**, copie [este prompt de instalação](https://raw.githubusercontent.com/noasantos/tcc-laurex/main/docs/SETUP_PROMPT.txt) e envie. O assistente com acesso ao terminal examina o contexto e os materiais acadêmicos disponíveis, reaproveita o projeto existente, organiza capítulos, conteúdo e fontes, prepara o MCP e entrega a URL do app já rodando. O repositório é público: não precisa de conta, convite ou token do GitHub para baixar. Preserve e retome essa conversa para trabalhar no TCC.

## Abrir pela primeira vez

1. Baixe este repositório como ZIP e extraia a pasta, ou clone-o.
2. **Windows:** abra `Configurar-Windows.cmd`. Ele verifica o componente necessário, instala pelo gestor do Windows quando disponível, prepara a aplicação e abre o navegador.
3. **macOS / Linux:** execute `Configurar.command`. É necessário Node.js LTS 24 instalado; se faltar, o script informa como obter a versão oficial.
4. Na tela de boas-vindas, dê um nome ao projeto e crie a estrutura de capítulos ou importe seu arquivo pelas configurações.

O configurador também conecta o MCP ao **Codex local** e testa a leitura do projeto. É necessário ter Codex instalado; caso a CLI não seja encontrada, o configurador informa como instalar a CLI oficial. Se a conversa já estava aberta, reabra o Codex uma vez e retome a mesma conversa para carregar as ferramentas.

Nas próximas vezes, peça no Codex: **“Abra meu Laura Workspace”**. Também pode usar **Abrir-Laura.cmd** ou **Abrir-Laura.command**. O app abre em http://localhost:3000 e continua rodando após fechar o terminal.

**Para enviar à Laura:** [prompt de instalação no Codex local](docs/SETUP_PROMPT.txt). Ele prepara o aplicativo e o MCP no computador dela, sem túnel ou configuração de conta Platform.

## O que você pode fazer

- Criar capítulos, seções e subseções antes de escrever; alterar títulos, ordem e andamento.
- Separar objetivos e planejamento do texto acadêmico, sem exportá-los por acidente.
- Editar texto, títulos, listas, tabelas, equações e figuras locais.
- Selecionar texto para abrir uma barra contextual de formatação e comentários.
- Responder, resolver e reabrir comentários; verificar sua associação ao trecho original.
- Guardar ideias, hipóteses, dúvidas, tarefas, decisões e sugestões da IA em um caderno separado.
- Cadastrar referências reais, importar BibTeX e abrir citações e notas de rodapé no contexto.
- Revisar propostas com comparação antes/depois. Aprovar e aplicar são ações separadas.
- Consultar versões, restaurar conteúdo e recuperar backups sem apagar o histórico existente.
- Usar modo claro, escuro ou conforme o sistema. O app ocupa toda a janela; apenas as áreas de conteúdo rolam.

![Interface em modo escuro](docs/screenshots/dark.png)

## Trabalhar com o Codex local

O Codex inicia o MCP stdio diretamente no mesmo computador. A instalação autoriza leitura e escrita apenas neste workspace; Configurações → Codex local permite consultar e revogar esse acesso. Revisões de texto existente exigem proposta e aprovação local; uma edição não resolve comentários automaticamente.

Para conectar uma instalação existente, execute `npm run assistant:connect -- --allow-local-write`. O script registra caminhos absolutos, preserva configurações de outros servidores, recusa substituir uma conexão de outro projeto e testa o MCP real sem modificar o texto acadêmico. O registro fica fora do checkout. Não é necessário deixar um túnel ou terminal aberto. Após alterar a pasta de dados, conecte novamente para atualizar o destino.

A conversa é a do Codex local; isso não importa automaticamente conversas antigas do ChatGPT. [Contexto acadêmico](docs/PROJECT_CONTEXT.txt) · [Operação e retomada](docs/OPERATING_MODEL.md). O fluxo remoto opcional do ChatGPT web está em [MCP.md](docs/MCP.md) e não faz parte da instalação padrão.

## Importar o TCC

Abra Configurações:

O documento permite alternar entre Visual, Código LaTeX e Lado a lado. O fonte nativo é versionado localmente; o MCP cria com `latex` e revisa com `afterLatex`, mediante aprovação. A visualização de código usa CodeMirror com realce de sintaxe e linhas numeradas.

- **LaTeX `.tex`:** um subconjunto seguro é convertido para edição visual. Comandos, ambientes ou argumentos não suportados fazem o arquivo permanecer como bloco protegido, sem descartar seu código.
- **Projeto `.zip`:** o arquivo completo é preservado. Escolha o `.tex` principal quando houver ambiguidade. O editor não expande automaticamente `\input`, estilos, macros e dependências.
- **Word `.docx`:** importação de texto com aviso explícito. A fidelidade de formatação, campos, tabelas e imagens permanece no original; não se apresenta isso como conversão acadêmica fiel.
- **BibTeX `.bib`:** entradas são analisadas por parser próprio. Nenhuma fonte ou DOI é inventado.

Os originais podem ser baixados novamente em Configurações. O arquivo de origem nunca é sobrescrito. Para projetos complexos, mantenha o LaTeX original como fonte final de formatação e utilize o workspace para planejamento e revisão. [Limites do LaTeX](docs/LATEX.md).

## Dados, backup e atualização

Em Configurações → Avançado → Alterar pasta dos dados, use **Escolher pasta…** para abrir o seletor nativo do macOS ou Windows. No Linux, o seletor usa Zenity ou KDialog quando disponíveis. Cancelar preserva a seleção anterior; selecionar uma pasta não copia nem muda os dados até a ação separada **Copiar projeto para esta pasta**. A opção de informar um caminho manual continua disponível como alternativa.

Os dados ficam **fora da pasta da aplicação**:

| Sistema | Pasta inicial                                  |
| ------- | ---------------------------------------------- |
| Windows | `%LOCALAPPDATA%\LauraWorkspace`                |
| macOS   | `~/Library/Application Support/LauraWorkspace` |
| Linux   | `~/.local/share/LauraWorkspace`                |

O caminho real aparece em Configurações. É possível copiar o projeto para uma pasta nova e vazia e passar a usá-la após reiniciar. O estado anterior permanece preservado. A alteração desliga a conexão MCP.

Há salvamento automático, rascunho de emergência no navegador e versões transacionais. O servidor local verifica alterações a cada hora: mantém uma cópia por hora nos últimos 7 dias e uma por dia até 30 dias, preservando sempre pelo menos três cópias automáticas existentes. A inicialização e o encerramento normal também tentam proteger as alterações; sem mudanças no projeto, histórico ou originais, nenhuma cópia idêntica é criada. Eventos de auditoria de consultas não geram duplicatas. Dias sem alterações não criam arquivos extras: a última cópia continua preservada.

Cada nova cópia automática passa por restauração em um banco temporário. Antes de qualquer limpeza, todas as cópias catalogadas têm sua integridade conferida e a cópia atual é validada por restauração. Uma falha interrompe a limpeza. Somente arquivos `auto-…json` registrados no índice automático pertencem a essa política; cópias manuais, pontos antes de operações e backups legados permanecem preservados. A antiga opção `backupRetentionDays` é mantida apenas para compatibilidade dos dados; a política automática fixa substitui essa configuração. Consulte [a política e recuperação](docs/RECOVERY.md).

- **Exportar tudo:** baixa um backup com documentos, planejamento, notas, comentários, referências, originais e versões.
- **Histórico:** compara e restaura versões do projeto; restaurar cria uma versão nova.
- **Restaurar backup:** importa um backup, verifica a integridade e preserva o estado atual antes de restaurar.
- Guarde também uma cópia do backup em outro disco. Um backup no mesmo computador não protege contra perda física do equipamento.

Para atualizar, encerre o app, preserve um backup, substitua **apenas a pasta da aplicação** e execute o configurador novamente. Não exclua a pasta de dados. Nunca armazene seu TCC dentro do repositório de código. Veja [recuperação](docs/RECOVERY.md).

## Limites e validação

A aplicação não verifica fontes academicamente nem certifica conformidade ABNT/UFRJ. A compilação visual produz PDF de revisão; o projeto institucional original continua responsável pelo PDF final. Construções não suportadas são preservadas ou bloqueiam a exportação, em vez de serem eliminadas silenciosamente.

O Windows é o alvo prioritário dos scripts. Execução interativa neste desenvolvimento ocorreu no macOS; a matriz de CI verifica o código em Windows e Linux. O resultado de uma execução no PC da Laura continua sendo uma etapa de aceitação separada.

[Arquitetura e desenvolvimento](docs/ARCHITECTURE.md) · [Testes e evidências](docs/VALIDATION.md) · [MCP](docs/MCP.md) · [Recuperação](docs/RECOVERY.md)
