import { spawn } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const applicationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const url = `http://127.0.0.1:${port}`;
export async function workspaceRuntime(root: string) {
  try {
    const response = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return { running: false, url, conflict: true };
    const health = (await response.json()) as any;
    const same =
      health.app === "laura-workspace" &&
      resolve(health.dataDirectory || "") === resolve(root);
    return { running: same, url, conflict: !same };
  } catch {
    return { running: false, url, conflict: false };
  }
}
let starting: Promise<any> | undefined;
export async function ensureWorkspaceRunning(root: string) {
  if (starting) return starting;
  starting = (async () => {
    const status = await workspaceRuntime(root);
    if (status.running) return { ...status, started: false };
    if (status.conflict)
      throw new Error(
        "A porta local está ocupada por outra aplicação ou projeto. Nenhum processo foi encerrado.",
      );
    if (!existsSync(join(applicationRoot, "dist", "index.html")))
      throw new Error(
        "A instalação precisa ser concluída pelo assistente local antes de iniciar.",
      );
    const log = openSync(
      join(root, "logs", "workspace-runtime.log"),
      "a",
      0o600,
    );
    let failure: Error | undefined;
    const child = spawn(
      process.execPath,
      ["--import", "tsx", join(applicationRoot, "server", "index.ts")],
      {
        cwd: applicationRoot,
        env: { ...process.env, LAURA_DATA_DIR: root, PORT: String(port) },
        detached: true,
        stdio: ["ignore", log, log],
        windowsHide: true,
      },
    );
    child.on("error", (error) => {
      failure = error;
    });
    child.unref();
    closeSync(log);
    for (let attempt = 0; attempt < 50; attempt++) {
      const current = await workspaceRuntime(root);
      if (current.running) return { ...current, started: true, pid: child.pid };
      if (failure) throw failure;
      if (current.conflict)
        throw new Error(
          "Outro processo ocupou a porta. Consulte o assistente local.",
        );
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(
      "O site ainda não respondeu. Os dados foram preservados; consulte o log local de inicialização.",
    );
  })();
  try {
    return await starting;
  } finally {
    starting = undefined;
  }
}
