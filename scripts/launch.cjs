const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
process.chdir(root);
function open() {
  const url = "http://localhost:3000";
  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const p = spawn(command, args, { stdio: "ignore", windowsHide: true });
  p.on("error", () => console.log("Abra " + url + " no navegador."));
  p.unref();
}
(async () => {
  try {
    const r = await fetch("http://localhost:3000/api/health");
    const health = await r.json();
    if (health.ok && health.app === "laura-workspace") {
      open();
      return;
    }
    throw new Error("A porta 3000 está ocupada por outra aplicação.");
  } catch (e) {
    if (e.message.includes("ocupada")) {
      console.error(e.message);
      process.exitCode = 1;
      return;
    }
  }
  if (!existsSync(resolve(root, "dist/index.html"))) {
    console.error(
      "Execute Configurar-Windows.cmd ou ./Configurar.command primeiro.",
    );
    process.exitCode = 1;
    return;
  }
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    { cwd: root, stdio: "inherit" },
  );
  let opened = false;
  const timer = setInterval(async () => {
    try {
      const r = await fetch("http://localhost:3000/api/health");
      if (r.ok && !opened) {
        opened = true;
        clearInterval(timer);
        open();
      }
    } catch {}
  }, 500);
  child.on("exit", (code) => {
    clearInterval(timer);
    process.exitCode = code || 0;
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
})();
