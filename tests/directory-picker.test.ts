import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseDirectory, DirectoryPicker } from "../server/directory-picker";

test("macOS returns a native chosen path, including spaces and shell characters as plain data", async () => {
  const path = "/tmp/Pasta ç ' $ (teste)/";
  assert.equal(
    await chooseDirectory("darwin", async (command, args) => {
      assert.equal(command, "/usr/bin/osascript");
      assert.deepEqual(args.slice(0, 3), ["-l", "JavaScript", "-e"]);
      assert.ok(args[3].includes("NSOpenPanel"));
      assert.ok(!args[3].includes(path));
      return { stdout: path + "\n" };
    }),
    path,
  );
});
test("Windows uses the native folder browser in STA mode and handles Unicode paths", async () => {
  const path = "C:\\Users\\Laura\\TCC ç";
  assert.equal(
    await chooseDirectory("win32", async (command, args) => {
      assert.equal(command, "powershell.exe");
      assert.ok(args.includes("-STA"));
      assert.ok(args.includes("-NoProfile"));
      assert.ok(args.at(-1)?.includes("FolderBrowserDialog"));
      return { stdout: path + "\r\n" };
    }),
    path,
  );
});
test("cancel returns no selection on macOS, Windows and Linux", async () => {
  for (const platform of ["darwin", "win32"] as const)
    assert.equal(
      await chooseDirectory(platform, async () => ({ stdout: "\n" })),
      null,
    );
  let calls = 0;
  assert.equal(
    await chooseDirectory("linux", async () => {
      calls++;
      throw Object.assign(new Error("Cancelled"), { code: 1 });
    }),
    null,
  );
  assert.equal(calls, 1);
});
test("Linux tries the available desktop picker; unavailable systems provide a manual fallback", async () => {
  const commands: string[] = [];
  assert.equal(
    await chooseDirectory("linux", async (command) => {
      commands.push(command);
      if (command === "zenity")
        throw Object.assign(new Error(), { code: "ENOENT" });
      return { stdout: "/tmp/pasta\n" };
    }),
    "/tmp/pasta",
  );
  assert.deepEqual(commands, ["zenity", "kdialog"]);
  await assert.rejects(
    chooseDirectory("linux", async () => {
      throw Object.assign(new Error(), { code: "ENOENT" });
    }),
    /manualmente/,
  );
});
test("invalid paths and execution failures never become a chosen directory", async () => {
  await assert.rejects(
    chooseDirectory("darwin", async () => ({ stdout: "relative/path\n" })),
    /manualmente/,
  );
  await assert.rejects(
    chooseDirectory("darwin", async () => {
      throw Object.assign(new Error("private process output"), {
        code: "ETIMEDOUT",
      });
    }),
    (error) => {
      assert.ok(!(error as Error).message.includes("private process output"));
      return true;
    },
  );
});
test("only one native window may be open; cancel and failures release the picker", async () => {
  let finish!: (path: string | null) => void;
  const picker = new DirectoryPicker(() => new Promise((r) => (finish = r)));
  const first = picker.pick();
  await assert.rejects(picker.pick(), { statusCode: 409 });
  finish(null);
  assert.equal(await first, null);
  const second = picker.pick();
  finish("/tmp/pasta");
  assert.equal(await second, "/tmp/pasta");
  let attempt = 0;
  const failing = new DirectoryPicker(async () => {
    if (++attempt === 1) throw new Error("failed");
    return null;
  });
  await assert.rejects(failing.pick());
  assert.equal(await failing.pick(), null);
});

test("cancelling an active native picker releases the window and does not return a new path", async () => {
  const picker = new DirectoryPicker(
    (signal) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve(null), { once: true }),
      ),
  );
  const result = picker.pick();
  picker.cancel();
  assert.equal(await result, null);
  picker.cancel();
  const next = picker.pick();
  picker.cancel();
  assert.equal(await next, null);
});
