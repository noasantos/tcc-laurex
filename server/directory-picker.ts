import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { posix, win32 } from "node:path";
const exec = promisify(execFile);
type Execute = (
  command: string,
  args: string[],
  signal?: AbortSignal,
) => Promise<{ stdout: string }>;
const execute: Execute = (command, args, signal) =>
  exec(command, args, {
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
    maxBuffer: 16384,
    windowsHide: true,
    shell: false,
    signal,
  });
const prompt =
  "Escolha uma pasta nova ou vazia para os dados do Laura Workspace";
const macScript = `
ObjC.import('AppKit');
const app = $.NSApplication.sharedApplication;
app.setActivationPolicy($.NSApplicationActivationPolicyRegular);
app.activateIgnoringOtherApps(true);
const panel = $.NSOpenPanel.openPanel;
panel.title = 'Escolher pasta';
panel.message = '${prompt}';
panel.canChooseDirectories = true;
panel.canChooseFiles = false;
panel.allowsMultipleSelection = false;
panel.canCreateDirectories = true;
let result = '';
if (panel.runModal === $.NSModalResponseOK) result = ObjC.unwrap(panel.URL.path);
result;
`;
const windowsScript = `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${prompt}'
$dialog.ShowNewFolderButton = $true
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Write($dialog.SelectedPath)
  }
} finally { $dialog.Dispose() }
`;
export async function chooseDirectory(
  platform: NodeJS.Platform = process.platform,
  run: Execute = execute,
  signal?: AbortSignal,
): Promise<string | null> {
  const commands: [string, string[]][] =
    platform === "darwin"
      ? [["/usr/bin/osascript", ["-l", "JavaScript", "-e", macScript]]]
      : platform === "win32"
        ? [
            [
              "powershell.exe",
              [
                "-NoProfile",
                "-NonInteractive",
                "-STA",
                "-Command",
                windowsScript,
              ],
            ],
          ]
        : platform === "linux"
          ? [
              [
                "zenity",
                ["--file-selection", "--directory", "--title=" + prompt],
              ],
              ["kdialog", ["--getexistingdirectory", ".", "--title", prompt]],
            ]
          : [];
  for (const [command, args] of commands) {
    try {
      const { stdout } = await run(command, args, signal);
      const selected = stdout.replace(/[\r\n]+$/, "");
      if (!selected) return null;
      const path = platform === "win32" ? win32 : posix;
      if (!path.isAbsolute(selected) || selected.includes("\0"))
        throw new Error("Invalid directory");
      return path.normalize(selected);
    } catch (error) {
      if (signal?.aborted) return null;
      const e = error as { code?: string | number };
      if (e.code === "ENOENT") continue;
      if (platform === "linux" && e.code === 1) return null;
      throw new Error(
        "Não foi possível abrir o seletor de pastas. Você pode informar o caminho manualmente.",
      );
    }
  }
  throw new Error(
    "O seletor de pastas não está disponível neste sistema. Informe o caminho manualmente.",
  );
}
export class DirectoryPicker {
  private controller: AbortController | null = null;
  constructor(
    private choose: (signal: AbortSignal) => Promise<string | null> = (
      signal,
    ) => chooseDirectory(process.platform, execute, signal),
  ) {}
  cancel() {
    this.controller?.abort();
  }
  async pick() {
    if (this.controller)
      throw Object.assign(
        new Error("Já há uma janela de seleção de pasta aberta."),
        { statusCode: 409 },
      );
    const controller = new AbortController();
    this.controller = controller;
    try {
      return await this.choose(controller.signal);
    } finally {
      this.controller = null;
    }
  }
}
