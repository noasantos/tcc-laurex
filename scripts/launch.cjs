const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
if (
  !existsSync(resolve(root, "node_modules/tsx/dist/loader.mjs")) ||
  !existsSync(resolve(root, "dist/index.html"))
) {
  console.error(
    "Execute Configurar-Windows.cmd ou ./Configurar.command primeiro.",
  );
  process.exitCode = 1;
} else {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve(root, "scripts/open-workspace.ts")],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code || 0;
  });
}
