import type { State } from "../server/types";
let token = "";
export async function request<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  if (body !== undefined && !token) {
    token = (await (await fetch("/api/session")).json()).token;
  }
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Laura-Token": token,
          },
          body: JSON.stringify(body),
        },
  );
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error || "Não foi possível concluir.");
  }
  return r.json();
}
export const action = (name: string, args: Record<string, unknown>) =>
  request("action/" + name, args);
export async function compilePdf() {
  if (!token) token = (await request("session")).token;
  const r = await fetch("/api/compile", {
    method: "POST",
    headers: { "X-Laura-Token": token },
  });
  if (!r.ok) throw new Error((await r.json()).error);
  const url = URL.createObjectURL(await r.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "TCC.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export type { State };
