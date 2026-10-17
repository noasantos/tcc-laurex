import { spawn } from "node:child_process";
import { Store } from "../server/store";
import { ensureWorkspaceRunning } from "../server/runtime";
const store = new Store();
try {
  const runtime = await ensureWorkspaceRunning(store.root);
  const command =
    process.platform === "win32"
      ? "explorer.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const child = spawn(command, [runtime.url], {
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => console.log(`Abra ${runtime.url} no navegador.`));
  child.unref();
  console.log(
    `Laura Workspace: ${runtime.url}. Pode fechar esta janela; o app continua rodando. No Codex, peça para abrir o workspace pelo MCP.`,
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  store.close();
}
