# ChatGPT connection: evidence and setup

Checked against official documentation during implementation on 17 October 2026:

- [Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Connect and test](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Official TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server)

The current documentation describes custom MCP servers as plugins and supports read/write tools, subject to account/workspace permissions and confirmation settings. Older guidance calls this Developer Mode or custom connectors. The currently fetched documentation does not establish a blanket guarantee that every personal Pro account can create the required tunnel or use every write tool. The account must be checked live. This repository does not contain a fake ChatGPT connection indicator.

## Proven locally

`npm run mcp:poc` starts an actual SDK client and stdio server, discovers the tools and performs read/create/comment/propose/apply operations. Applying before local approval fails. After local approval, applying succeeds and the comment remains open. The HTTP integration test separately exercises authentication and Streamable HTTP. These are protocol proofs, not a successful call from Laura's ChatGPT account.

## Preferred private connection

1. During assisted installation, run `npm run assistant:prepare -- --allow-chatgpt-write` with explicit local authorization. The local UI also allows authorizing or revoking this single-project integration. Read the transmission notice.
2. In the intended ChatGPT account and Platform organization, check custom MCP availability and tunnel access. Tunnel creation needs Tunnels Read + Manage; running/selecting a tunnel needs Read + Use. Associate the tunnel with the intended ChatGPT workspace and Platform organization.
3. Obtain the official `tunnel-client` from Platform tunnel settings or [official releases](https://github.com/openai/tunnel-client/releases/latest). Read its actual help for the installed version.
4. Configure a stdio profile whose command runs the local `server/stdio.ts`, using the full local Node path and repository path. The launcher command is equivalent to `node --import tsx server/stdio.ts`, with the repository as working directory. Use absolute paths when the tunnel runner does not support a working directory. Do not place secrets in repository files or chat.
5. Configure the runtime control-plane key through a protected local environment/credential mechanism. This key transports MCP requests; the application never calls a text-generation API.
6. Run the tunnel's doctor command and then its run command. No inbound firewall port is required. Do not forward the whole web application to the internet.
7. In the ChatGPT web interface, open Plugins → Add custom MCP server → Connection: Tunnel. Select the same tunnel, review the tool list, authentication and risk notice, and install the private plugin.
8. In a new conversation, select the plugin and run the acceptance prompts below. Save the actual results and errors. Do not call setup complete until those calls succeed in that account.
9. To disconnect, switch off MCP in Laura Workspace and stop the tunnel. Local writing and reading keep working without it.

The secure tunnel is optional and is **not created or enabled automatically**. No credentials were requested or configured during repository development. Account setup, permissions and a real ChatGPT call remain an external acceptance gate.

## Acceptance prompts

1. “Use Laura Workspace to read the project information and list chapters. Do not use other tools.”
2. “Create a note titled MCP validation with the content This is a connection test.” Verify it in the notebook.
3. “Create a comment about this chapter and propose a short edit linked to it. Do not resolve the comment.”
4. Attempt applying before Laura's approval: the server must refuse.
5. Approve in the local workspace, then ask to apply the approved proposal. Verify the diff, operation, version and still-open comment.
6. Disable MCP and attempt another read/write: the server must refuse.

## Tool contract

The current canonical names from the completed brief are exposed. Compatibility names from the first brief map to the same domain operations internally, avoiding duplicate implementations. `npm run mcp:poc` verifies discovery.

Read get_project_info first to obtain revision; get_chapter returns chapter revision. Every mutation supplies expectedRevision. Native LaTeX proposals supply chapterRevision and afterLatex (complete literal TeX). Use create_chapter with latex, get_chapter_latex to read, and propose_latex_edit to revise. The validated TipTap after document remains a compatibility path only for the supported visual subset. Never send both after and afterLatex. IDs are stable. Proposals can optionally reference a real comment in the same chapter. No tool can approve a proposal, execute arbitrary commands, choose arbitrary filesystem paths or read unrelated folders.

Local approval is a separate authority. `propose_restore` only directs Laura to the local history UI. It cannot execute a restore. `create_checkpoint` requires write consent; integrity queries are read-only. Structured outputs use a result envelope; mutations include project revision and operation ID. Tool input schemas reject unknown arguments.

## Assisted daily use

See [OPERATING_MODEL.md](OPERATING_MODEL.md). Runtime tools can restart the web process while the independent stdio MCP/tunnel remains available. `create_project_archive` creates a verified full ZIP only when requested. The manual JSON exchange is a support endpoint, not a normal UI workflow. Project instructions must actually be saved in Laura's existing ChatGPT project; a repository file alone does not update them.

## Referências copiadas de comentários

No documento ou na lateral, use a ação de copiar a referência `C-xxxxxxxx` e cole o pedido na conversa do TCC. O pedido identifica a ferramenta `get_comment_context` e o ID exato. A consulta retorna projeto, capítulo, revisões, seleção original, localização/trecho atual quando recuperável, respostas, histórico e propostas. Referências curtas também são aceitas diretamente; colisões são rejeitadas e exigem o ID completo. Não presuma que o trecho ainda existe: verifique `anchorResolution` e `currentExcerpt`. A cópia não ativa nem configura uma conexão MCP ausente.


### Revisar um comentário com antes e depois

Use `get_comment_context` e então `propose_comment_edit` com `commentId`, `chapterId`, `chapterRevision`, `expectedRevision`, `afterLatex` e `reason`. Essa ferramenta exige o comentário; o servidor captura o antes diretamente do documento atual. Não envie um antes fabricado. O depois deve conter o fonte completo revisado do capítulo. A proposta não altera o texto até a aprovação local e a aplicação de `apply_approved_edit`.

`get_comment_context` / `get_comment_history` devolvem as propostas completas vinculadas, com snapshots antes/depois, estado, datas, versão aplicada e operação. O histórico do comentário registra a proposta e sua aplicação. Aplicar, rejeitar ou responder não conclui o comentário: só `resolve_comment` (decisão explícita) e `reopen_comment` mudam entre `open` e `resolved`. `set_comment_state` aceita somente esses dois valores; metadados antigos de “análise” são preservados em backups, mas não representam um terceiro estado.

Na interface, **Concluir** e **Reabrir** ficam no cabeçalho do comentário. **Antes e depois** abre uma comparação independente das respostas; **Ver no documento** amplia a comparação em uma área somente leitura, com contexto recolhido e opção de fonte LaTeX. São snapshots históricos, não uma promessa de que o documento atual ainda corresponda à proposta.
