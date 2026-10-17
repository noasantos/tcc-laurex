import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Store, atomic } from "../server/store";
import { Domain } from "../server/domain";
if (!process.argv.includes("--allow-chatgpt-write")) {
  console.error(
    "Nenhuma alteração feita. A preparação exige autorização explícita: npm run assistant:prepare -- --allow-chatgpt-write",
  );
  process.exitCode = 1;
} else {
  const store = new Store();
  try {
    const backup = store.backup();
    const state = store.get();
    new Domain(store).call("update_settings", {
      expectedRevision: state.revision,
      mcpEnabled: true,
      mcpWrite: true,
    });
    mkdirSync(join(store.root, "setup"), { recursive: true });
    atomic(
      join(store.root, "setup", "assistant.json"),
      JSON.stringify(
        {
          preparedAt: new Date().toISOString(),
          repository: resolve("."),
          projectId: state.id,
          mcpStdio: {
            command: process.execPath,
            args: [
              "--import",
              pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
              resolve("server/stdio.ts"),
            ],
            env: { LAURA_DATA_DIR: store.root },
          },
          localConsent: "read-write",
          chatgptAccountVerified: false,
          tunnelConfigured: false,
          startupConfigured: false,
          contextFile: resolve("docs/PROJECT_CONTEXT.txt"),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          prepared: true,
          projectId: state.id,
          localReadWrite: true,
          backup,
          tunnelConfigured: false,
          chatgptAccountVerified: false,
          next: "Conectar o túnel, salvar o contexto no projeto existente e validar na conta da Laura.",
        },
        null,
        2,
      ),
    );
  } finally {
    store.close();
  }
}
