import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Store } from "../server/store";
import { Domain } from "../server/domain";

const canRun =
  existsSync("dist/index.html") && existsSync(chromium.executablePath());
test(
  "real browser: setup import/cancel, empty tour, resume, fresh context/port, replay, actual comments and hints",
  {
    skip: canRun
      ? false
      : "Build the app and install Playwright Chromium for browser coverage",
    timeout: 90000,
  },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "laurex-onboarding-browser-"));
    const browser = await chromium.launch({
      executablePath: chromium.executablePath(),
    });
    let shutdown: (() => Promise<void>) | undefined;
    async function start() {
      const socket = createServer();
      await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
      const port = (socket.address() as any).port;
      await new Promise<void>((r) => socket.close(() => r()));
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "server/index.ts"],
        {
          env: { ...process.env, PORT: String(port), LAURA_DATA_DIR: root },
          stdio: "ignore",
        },
      );
      shutdown = async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const done = new Promise((r) => child.once("exit", r));
        child.kill("SIGTERM");
        await done;
      };
      const url = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(url + "/api/health")).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 50));
      }
      return url;
    }
    let debugPage: Page | undefined;
    const errors: string[] = [];
    const progress = (p: Page, n: number) =>
      p
        .locator(".driver-popover-progress-text")
        .filter({ hasText: `${n} de 6` })
        .waitFor();
    try {
      const initial = new Store(root);
      new Domain(initial).call("update_settings", {expectedRevision: initial.get().revision, mcpEnabled: true, mcpWrite: true});
      initial.close();
      let url = await start();
      let context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      let page = await context.newPage();
      debugPage = page;
      page.setDefaultTimeout(7000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      assert.equal(await page.title(), "LAUREX");
      // Exercise the actual installer order: MCP consent precedes the academic setup.
      await page.getByText("acesso MCP local autorizado", {exact: false}).waitFor();
      await page.getByRole("button", {name: "Começar com uma estrutura de capítulos", exact: true}).click();
      await page.getByRole("button", {name: "5. Considerações finais", exact: true}).waitFor();
      await page.getByRole("heading", {name: "Bem-vinda, Laura", exact: true}).waitFor({state: "detached"});
      const preset = await page.evaluate(async () => (await fetch("/api/state")).json());
      assert.deepEqual(preset.chapters.map((c: any) => c.title), ["Introdução", "Referencial teórico", "Metodologia", "Resultados", "Considerações finais"]);
      assert.deepEqual(preset.chapters.map((c: any) => c.number), [1, 2, 3, 4, 5]);
      assert.ok(preset.chapters.every((c: any) => c.status === "Planejado"));
      await context.close();
      await shutdown!();
      rmSync(root, {recursive: true, force: true});
      url = await start();
      context = await browser.newContext({viewport: {width: 1280, height: 900}});
      page = await context.newPage();
      debugPage = page;
      page.setDefaultTimeout(7000);
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(url);

      await page
        .getByRole("button", { name: "Importar meu LaTeX primeiro" })
        .click();
      await page
        .getByRole("button", { name: "Cancelar importação e continuar" })
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Conhecer meu espaço" }).count(),
        0,
      );
      await page
        .getByRole("button", { name: "Cancelar importação e continuar" })
        .click();
      await page.getByRole("button", { name: "Conhecer meu espaço" }).click();
      await progress(page, 1);
      await page.locator(".driver-popover-next-btn").click();
      await progress(page, 2);
      assert.match(
        await page.locator(".driver-popover-description").innerText(),
        /primeiro capítulo/,
      );
      await page.keyboard.press("Escape");
      await page.locator(".driver-popover").waitFor({ state: "detached" });
      assert.equal(
        await page
          .getByRole("button", { name: "Continuar apresentação", exact: true })
          .count(),
        0,
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Continuar apresentação", exact: true })
        .click();
      await progress(page, 2);
      for (let i = 3; i <= 6; i++) {
        await page.locator(".driver-popover-next-btn").click();
        await progress(page, i);
      }
      await page.getByRole("button", { name: "Começar meu trabalho" }).click();
      await page.locator(".driver-popover").waitFor({ state: "detached" });
      let metadata = await page.evaluate(async () =>
        (await fetch("/api/onboarding")).json(),
      );
      assert.equal(metadata.status, "completed");
      assert.equal(metadata.setup, "ready");
      await context.close();
      await shutdown!();
      url = await start();
      context = await browser.newContext();
      page = await context.newPage();
      debugPage = page;
      page.setDefaultTimeout(7000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page
        .getByRole("button", { name: "Configurações", exact: true })
        .waitFor();
      assert.equal(await page.locator(".tour-invitation").count(), 0);
      assert.equal(
        await page.getByText("Um espaço para o seu TCC.").count(),
        0,
      );
      // A fresh context has no browser welcome flag, draft, session or storage from the first port.
      for (let i = 0; i < 2; i++) {
        await page
          .getByRole("button", { name: "Configurações", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Fazer tour novamente" })
          .click();
        try {
          await progress(page, 1);
        } catch (e) {
          console.log(
            "REPLAY DEBUG",
            i,
            await page.locator("body").innerText(),
            await page.evaluate(async () =>
              (await fetch("/api/onboarding")).json(),
            ),
          );
          throw e;
        }
        await page.keyboard.press("Escape");
        await page.locator(".driver-popover").waitFor({ state: "detached" });
      }
      await page.reload();
      metadata = await page.evaluate(async () =>
        (await fetch("/api/onboarding")).json(),
      );
      assert.equal(metadata.status, "completed");
      assert.equal(await page.locator(".tour-invitation").count(), 0);
      // Academic fixtures exist only in this disposable directory, never in onboarding code.
      await page.evaluate(async () => {
        const { token } = await (await fetch("/api/session")).json();
        const state = await (await fetch("/api/state")).json();
        const r = await fetch("/api/action/create_chapter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Laura-Token": token,
          },
          body: JSON.stringify({
            expectedRevision: state.revision,
            title: "Capítulo de teste",
            content: {
              type: "doc",
              content: Array.from({ length: 40 }, (_, i) => ({
                type: "paragraph",
                attrs: { id: crypto.randomUUID() },
                content: [
                  {
                    type: "text",
                    text: `Texto de validação ${i}. Este conteúdo pertence apenas ao teste automatizado.`,
                  },
                ],
              })),
            },
          }),
        });
        if (!r.ok) throw new Error(await r.text());
      });
      await page.reload();
      await page
        .getByRole("button", { name: /Capítulo de teste/ })
        .first()
        .click();
      await page.locator(".ProseMirror").waitFor();
      await page.getByRole("note", { name: "Escolha como ler" }).waitFor();
      await page
        .getByRole("note", { name: "Escolha como ler" })
        .getByRole("button")
        .click();
      await page
        .locator(".ProseMirror p")
        .first()
        .evaluate((el) => {
          const editor = el.closest<HTMLElement>("[contenteditable]")!;
          editor.focus();
          const range = document.createRange();
          range.setStart(el.firstChild!, 0);
          range.setEnd(el.firstChild!, 20);
          const selection = window.getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range);
          document.dispatchEvent(new Event("selectionchange"));
        });
      await page
        .getByRole("toolbar", { name: "Ferramentas do trecho selecionado" })
        .waitFor();
      const selection = await page.evaluate(() =>
        window.getSelection()?.toString(),
      );
      assert.ok(selection);
      await page.getByRole("note", { name: "Ferramentas do trecho" }).waitFor();
      await page
        .getByRole("note", { name: "Ferramentas do trecho" })
        .getByRole("button")
        .click();
      assert.equal(
        await page.evaluate(() => window.getSelection()?.toString()),
        selection,
      );
      await page.getByRole("button", { name: "Comentar", exact: true }).click();
      await page
        .getByPlaceholder("O que você gostaria de orientar ou revisar?")
        .fill("Comentário do teste");
      await page
        .locator("form")
        .filter({
          has: page.getByPlaceholder(
            "O que você gostaria de orientar ou revisar?",
          ),
        })
        .getByRole("button", { name: "Comentar", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Comentários", exact: true })
        .click();
      await page
        .getByText("Comentário do teste", { exact: true })
        .first()
        .click();
      await page
        .getByRole("note", { name: "Leve o contexto para a conversa" })
        .waitFor();
      await page
        .getByRole("note", { name: "Leve o contexto para a conversa" })
        .getByRole("button")
        .click();
      await page
        .getByRole("button", { name: /Capítulo de teste/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Planejamento", exact: true })
        .click();
      await page
        .getByRole("note", { name: "Planeje sem alterar o texto" })
        .waitFor();
      await page
        .getByRole("note", { name: "Planeje sem alterar o texto" })
        .getByRole("button")
        .click();
      await page.keyboard.press("Escape");

      // Persist a real editor change, then inspect an actual proposal and its independent hint.
      await page.locator(".ProseMirror p").first().click();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.type(" trecho salvo");
      await page.getByText("Salvo", { exact: true }).waitFor();
      await page.reload();
      await page.locator(".ProseMirror").waitFor();
      assert.match(
        await page.locator(".ProseMirror").innerText(),
        /trecho salvo/,
      );
      await page.evaluate(async () => {
        const { token } = await (await fetch("/api/session")).json();
        const s = await (await fetch("/api/state")).json();
        const c = s.chapters[0];
        const after = structuredClone(c.content);
        after.content[0].content[0].text += " Proposta de teste.";
        const r = await fetch("/api/action/propose_edit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Laura-Token": token,
          },
          body: JSON.stringify({
            expectedRevision: s.revision,
            chapterId: c.id,
            chapterRevision: c.revision,
            after,
            reason: "Proposta para validar a dica",
          }),
        });
        if (!r.ok) throw new Error(await r.text());
      });
      await page.reload();
      if (
        await page
          .getByRole("button", { name: "Mostrar navegação" })
          .isVisible()
      )
        await page.getByRole("button", { name: "Mostrar navegação" }).click();
      await page.getByRole("button", { name: /Alterações propostas/ }).click();
      await page.getByRole("note", { name: "Revise cada mudança" }).waitFor();
      await page
        .getByRole("note", { name: "Revise cada mudança" })
        .getByRole("button")
        .click();
      await page
        .getByRole("button", { name: "Configurações", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ativar modo escuro", exact: true })
        .click();
      await page.evaluate(() =>
        localStorage.setItem("laura-navigation-pinned", "false"),
      );
      await page.reload();
      await page.getByRole("button", { name: "Fazer tour novamente" }).click();
      await progress(page, 1);
      assert.equal(await page.locator(".tour-hint").count(), 0);
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("laura-navigation-pinned"),
        ),
        "false",
      );
      await page.locator(".driver-popover-next-btn").focus();
      await page.keyboard.press("Enter");
      await progress(page, 2);
      await page.locator('[data-tour="editor"] [data-hint="modes"]').waitFor();
      await page.screenshot({ path: "/tmp/laurex-tour-populated-dark.png" });
      for (let i = 3; i <= 6; i++) {
        await page.locator(".driver-popover-next-btn").click();
        await progress(page, i);
      }
      await page.screenshot({ path: "/tmp/laurex-tour-header-dark.png" });
      await page.keyboard.press("Escape");
      await page.locator(".driver-popover").waitFor({ state: "detached" });
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("laura-navigation-pinned"),
        ),
        "false",
      );
      await page.setViewportSize({ width: 390, height: 760 });
      await page.getByRole("button", { name: "Fazer tour novamente" }).click();
      await progress(page, 1);
      await page.screenshot({ path: "/tmp/laurex-tour-mobile-dark.png" });
      for (let i = 2; i <= 6; i++) {
        await page.locator(".driver-popover-next-btn").click();
        await progress(page, i);
        const r = await page.locator(".driver-popover").boundingBox();
        assert.ok(
          r &&
            r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.width <= 391 &&
            r.y + r.height <= 761,
          `popover ${i} fits narrow window`,
        );
      }
      await page.screenshot({ path: "/tmp/laurex-tour-mobile-header.png" });
      await page.keyboard.press("Escape");
      await page.locator(".driver-popover").waitFor({ state: "detached" });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
        true,
        "only content panes scroll",
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page
        .getByRole("button", { name: "Ativar modo claro", exact: true })
        .click();
      await page.getByRole("button", { name: "Fazer tour novamente" }).click();
      await progress(page, 1);
      const navigationBounds = await page.locator('[data-tour="navigation"]').boundingBox();
      assert.ok(navigationBounds && navigationBounds.x >= 0 && navigationBounds.width >= 230 && navigationBounds.x + navigationBounds.width <= 1280, "the sidebar target is fully on screen before highlighting");
      await page.screenshot({ path: "/tmp/laurex-tour-light.png" });
      await page.keyboard.press("Escape");

      await page.route("**/api/onboarding", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Armazenamento indisponível no teste",
          }),
        }),
      );
      await page.reload();
      await page
        .getByRole("status")
        .filter({ hasText: "Não foi possível carregar a apresentação" })
        .waitFor();
      assert.equal(
        await page.locator(".tour-invitation").count(),
        0,
        "loading failure is never a first visit",
      );
      await page.unroute("**/api/onboarding");
      assert.deepEqual(errors, []);
    } catch (e) {
      if (debugPage) {
        console.log(
          "BROWSER FAILURE",
          await debugPage.locator("body").innerText(),
        );
        await debugPage.screenshot({
          path: "/tmp/laurex-onboarding-browser-failure.png",
        });
      }
      throw e;
    } finally {
      await browser.close();
      await shutdown?.();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
