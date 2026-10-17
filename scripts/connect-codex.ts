import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Store, atomic } from "../server/store";
import { Domain } from "../server/domain";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function findCodex() {
  const candidates = [
    ...(process.env.CODEX_CLI_PATH ? [process.env.CODEX_CLI_PATH] : []),
    ...(process.env.PATH || "")
      .split(delimiter)
      .flatMap((p) =>
        process.platform === "win32"
          ? [
              join(p, "codex.exe"),
              join(p, "node_modules/@openai/codex/bin/codex.js"),
            ]
          : [join(p, "codex")],
      ),
    "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
  ];
  const command = candidates.find((p) => existsSync(p));
  if (!command)
    throw new Error(
      "Abra o Codex local primeiro. Se o comando não estiver disponível, instale a CLI oficial com npm install -g @openai/codex e execute o configurador novamente.",
    );
  return command.endsWith(".js") ? [process.execPath, command] : [command];
}
export type RunCodex = (args: string[]) => string;
export function registerCodex(
  run: RunCodex,
  transport: {
    command: string;
    args: string[];
    env: { LAURA_DATA_DIR: string };
  },
) {
  const list = JSON.parse(run(["mcp", "list", "--json"]));
  const existing = list.find((x: any) => x.name === "laura-workspace");
  if (
    existing &&
    resolve(existing.transport?.env?.LAURA_DATA_DIR || "") !==
      resolve(transport.env.LAURA_DATA_DIR)
  ) {
    throw new Error(
      "Já existe um laura-workspace ligado a outra pasta de dados. A conexão existente foi preservada; confira qual projeto deve ser usado.",
    );
  }
  run([
    "mcp",
    "add",
    "laura-workspace",
    "--env",
    `LAURA_DATA_DIR=${transport.env.LAURA_DATA_DIR}`,
    "--",
    transport.command,
    ...transport.args,
  ]);
  const registered = JSON.parse(
    run(["mcp", "get", "laura-workspace", "--json"]),
  );
  if (
    !registered.enabled ||
    registered.transport?.command !== transport.command ||
    JSON.stringify(registered.transport.args) !==
      JSON.stringify(transport.args) ||
    registered.transport.env?.LAURA_DATA_DIR !== transport.env.LAURA_DATA_DIR
  ) {
    throw new Error(
      "O Codex não confirmou a configuração esperada. Nenhum teste de conexão foi declarado concluído.",
    );
  }
}
export async function connectCodex(run: RunCodex, store: Store) {
  const transport = {
    command: process.execPath,
    args: [
      "--import",
      pathToFileURL(join(repository, "node_modules/tsx/dist/loader.mjs")).href,
      join(repository, "server/stdio.ts"),
    ],
    env: { LAURA_DATA_DIR: store.root },
  };
  // Check registration before granting local write access.
  registerCodex(run, transport);
  const state = store.get();
  if (!state.settings.mcpEnabled || !state.settings.mcpWrite) {
    store.backup();
    new Domain(store).call("update_settings", {
      expectedRevision: state.revision,
      mcpEnabled: true,
      mcpWrite: true,
    });
  }
  const client = new Client({ name: "laura-local-setup", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport(transport));
    const result: any = await client.callTool({
      name: "get_project_info",
      arguments: {},
    });
    if (result.isError || result.structuredContent?.result?.id !== state.id)
      throw new Error("O MCP não confirmou o projeto local esperado.");
    const tools = await client.listTools();
    if (!tools.tools.some((t) => t.name === "ensure_workspace_running"))
      throw new Error("Ferramenta de inicialização indisponível.");
    mkdirSync(join(store.root, "setup"), { recursive: true });
    atomic(
      join(store.root, "setup/codex.json"),
      JSON.stringify(
        {
          preparedAt: new Date().toISOString(),
          client: "codex-local",
          projectId: state.id,
          repository,
          mcpStdio: transport,
          protocolVerified: true,
          tools: tools.tools.length,
        },
        null,
        2,
      ),
    );
    return tools.tools.length;
  } finally {
    await client.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let store: Store | undefined;
  try {
    if (!process.argv.includes("--allow-local-write"))
      throw new Error(
        "A configuração exige --allow-local-write para autorizar o MCP deste workspace.",
      );
    const [command, ...prefix] = findCodex();
    const run: RunCodex = (args) => {
      const result = spawnSync(command, [...prefix, ...args], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 30000,
      });
      if (result.error || result.status !== 0)
        throw new Error(
          `Não foi possível configurar o Codex local: ${result.error?.message || result.stderr}`,
        );
      return result.stdout;
    };
    store = new Store();
    const count = await connectCodex(run, store);
    console.log(
      `Codex local conectado: ${count} ferramentas. Reabra o Codex se a conversa já estava aberta. Peça: “Abra meu Laura Workspace e consulte o projeto pelo MCP”.`,
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    store?.close();
  }
}
