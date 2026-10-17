import repairPrompt from "../../docs/MCP_REPAIR_PROMPT.txt?raw";
import { Copy, Check } from "lucide-react";
import { ImportDropzone, type ImportResult } from "./ImportDropzone";
import { Appearance } from "./Appearance";
import { Select, SelectOption } from "./Select";
import { useEffect, useState } from "react";
import { Upload, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import type { State } from "../../server/types";
import { request } from "../api";
import { Field } from "./Primitives";
import type { Mutate } from "./Review";
export function Settings({
  state,
  mutate,
  refresh,
  onTheme,
  theme,
  initialTab = "general",
  onTabChange,
}: {
  state: State;
  mutate: Mutate;
  refresh: () => Promise<void>;
  onTheme: (s: string) => void;
  theme: string;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [copied, setCopied] = useState("");
  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setMessage(
        "Não foi possível copiar. Use os arquivos de instruções fornecidos na instalação.",
      );
    }
  }
  const [importReset, setImportReset] = useState(0);
  const [diagnostic, setDiagnostic] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [archive, setArchive] = useState<{ file: File; files: string[] } | null>(
      null,
    ),
    [sources, setSources] = useState<any[]>([]),
    [pendingBackup, setPendingBackup] = useState<any>(null),
    [directory, setDirectory] = useState("");
  useEffect(() => {
    request("sources")
      .then(setSources)
      .catch((e) => setMessage(e.message));
    request("diagnostics")
      .then(setDiagnostic)
      .catch((e) => setMessage(e.message));
  }, []);
  async function doWork(fn: () => Promise<any>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importAcademicFile(file: File): Promise<ImportResult> {
    setBusy(true);
    setMessage("");
    setArchive(null);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let result: ImportResult;
      if (extension === "tex") {
        const r = await request("import/latex", {
          expectedRevision: state.revision,
          name: file.name.replace(/\.tex$/i, ""),
          source: await file.text(),
        });
        result = {
          message: r.warnings.length
            ? "Importado com proteção: " + r.warnings.join("; ")
            : "Documento importado. Já está disponível nos capítulos.",
        };
      } else if (extension === "bib") {
        const r = await request("import/bibtex", {
          expectedRevision: state.revision,
          source: await file.text(),
        });
        result = {
          message: r.result.count
            ? `${r.result.count} referência(s) adicionada(s) à biblioteca.`
            : "As referências deste arquivo já estão cadastradas. Nenhuma duplicata foi criada.",
        };
      } else {
        const r = await request("import/archive", {
          expectedRevision: state.revision,
          name: file.name,
          base64: await fileBase64(file),
          kind: extension === "docx" ? "docx" : "zip",
        });
        if (r.selectionRequired) {
          setArchive({ file, files: r.files });
          return {
            pending: true,
            message: "Escolha abaixo o arquivo LaTeX principal para concluir.",
          };
        }
        result = {
          message: r.warnings.length
            ? r.warnings.join("; ")
            : "Projeto importado. O arquivo original foi preservado.",
        };
      }
      await refresh();
      setSources(await request("sources"));
      return result;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-content">
      <nav className="settings-tabs" aria-label="Seções das configurações">
        {[
          ["general", "Geral"],
          ["files", "Arquivos"],
          ["chatgpt", "ChatGPT"],
          ["safety", "Avançado"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            aria-pressed={tab === id}
            onClick={() => { setTab(id); onTabChange?.(id); }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="settings-section" hidden={tab !== "general"}>
        <h3>Projeto</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate("update_settings", {
              name: new FormData(e.currentTarget).get("name"),
            });
            setMessage("Nome atualizado.");
          }}
        >
          <Field label="Nome do trabalho">
            <input name="name" defaultValue={state.name} required />
          </Field>
          <button>Guardar nome</button>
        </form>
        <Appearance theme={theme} onTheme={onTheme} />
      </div>
      <div className="settings-section" hidden={tab !== "files"}>
        <h3>Arquivos acadêmicos</h3>
        <p className="subtle">
          Os originais são copiados para um arquivo protegido. Importar nunca
          sobrescreve o arquivo de origem.
        </p>
        <ImportDropzone
          disabled={busy}
          resetKey={importReset}
          onImport={importAcademicFile}
        />
        {archive && (
          <div className="import-main-choice">
            <Field label="Escolha o arquivo LaTeX principal">
              <Select
                defaultValue=""
                disabled={busy}
                onValueChange={(value) => {
                  if (value)
                    void doWork(async () => {
                      const r = await request("import/archive", {
                        expectedRevision: state.revision,
                        name: archive.file.name,
                        base64: await fileBase64(archive.file),
                        kind: "zip",
                        main: value,
                      });
                      await refresh();
                      setSources(await request("sources"));
                      setArchive(null);
                      setImportReset((n) => n + 1);
                      setMessage(
                        r.warnings.length
                          ? r.warnings.join("; ")
                          : "Projeto importado. O arquivo original foi preservado.",
                      );
                    });
                }}
              >
                <SelectOption value="">Selecione…</SelectOption>
                {archive.files.map((name) => (
                  <SelectOption key={name}>{name}</SelectOption>
                ))}
              </Select>
            </Field>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setArchive(null);
                setImportReset((n) => n + 1);
              }}
            >
              Cancelar escolha
            </button>
          </div>
        )}
        {sources.length > 0 && (
          <details>
            <summary>Originais preservados ({sources.length})</summary>
            {sources.map((source) => (
              <a
                className="list-link"
                key={source.id}
                href={"/api/sources/" + source.id}
                download
              >
                {source.name} · baixar original
              </a>
            ))}
          </details>
        )}
      </div>
      <div className="settings-section" hidden={tab !== "safety"}>
        <h3>Dados e recuperação</h3>
        <p className="data-path">
          Dados locais: {diagnostic?.root || "Consultando…"}
        </p>
        <details>
          <summary>Alterar pasta dos dados</summary>
          <p className="subtle">
            Use uma pasta nova ou vazia, fora da aplicação. O estado atual é
            preservado, o backup é testado e você reinicia para utilizar a nova
            pasta.
          </p>
          <input
            aria-label="Nova pasta dos dados"
            placeholder="Caminho completo da nova pasta"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
          />
          <button
            disabled={!directory || busy}
            onClick={() =>
              doWork(async () => {
                const r = await request("location", {
                  expectedRevision: state.revision,
                  directory,
                  confirmed: true,
                });
                setMessage(
                  r.restartRequired
                    ? "Pasta alterada com segurança. Encerre e abra novamente o Laura Workspace para continuar. Os dados antigos foram preservados."
                    : "A pasta selecionada já está em uso.",
                );
              })
            }
          >
            Copiar projeto e usar esta pasta
          </button>
        </details>
        <Field label="Retenção dos backups automáticos (dias; 0 mantém todos)">
          <input
            type="number"
            min="0"
            max="3650"
            defaultValue={state.settings.backupRetentionDays || 0}
            onBlur={(e) => {
              const days = Number(e.target.value);
              if (
                Number.isInteger(days) &&
                days >= 0 &&
                days <= 3650 &&
                days !== (state.settings.backupRetentionDays || 0)
              )
                void mutate("update_settings", { backupRetentionDays: days });
            }}
          />
        </Field>
        <div className="actions">
          <button
            onClick={() =>
              doWork(async () => {
                const r = await request("backup", {});
                setMessage("Backup verificado e criado: " + r.file);
              })
            }
          >
            <ShieldCheck size={16} /> Fazer backup agora
          </button>
          <button
            onClick={() =>
              doWork(async () => {
                const r = await request("diagnostics");
                setDiagnostic(r);
                setMessage("Verificação SQLite: " + JSON.stringify(r.database));
              })
            }
          >
            Verificar integridade
          </button>
        </div>
        <label className="button">
          <Upload size={16} /> Restaurar backup
          <input
            hidden
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void doWork(async () => {
                  const data = JSON.parse(await file.text());
                  if (data.payload?.format !== "laura-backup-v1")
                    throw new Error(
                      "Este arquivo não é um backup do Laura Workspace",
                    );
                  setPendingBackup(data);
                });
            }}
          />
        </label>
        {pendingBackup && (
          <div className="notice">
            <strong>Rever recuperação</strong>
            <p>
              {pendingBackup.payload.state.chapters.length} capítulos,{" "}
              {pendingBackup.payload.state.comments.length} comentários e{" "}
              {pendingBackup.payload.state.notes.length} notas. O estado atual
              será preservado antes da restauração. A conexão MCP será
              desligada.
            </p>
            <div className="actions">
              <button
                disabled={busy}
                className="primary"
                onClick={() =>
                  doWork(async () => {
                    await request("import/backup", {
                      expectedRevision: state.revision,
                      confirmed: true,
                      backup: pendingBackup,
                    });
                    await refresh();
                    setPendingBackup(null);
                    setMessage("Backup restaurado e histórico preservado.");
                  })
                }
              >
                Preservar estado atual e restaurar
              </button>
              <button onClick={() => setPendingBackup(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      <div className="settings-section" hidden={tab !== "chatgpt"}>
        <h3>Continue na sua conversa do TCC.</h3>
        <p className="subtle">
          O ChatGPT organiza, escreve e cadastra as fontes. Aqui você acompanha
          o documento, comenta os trechos e revisa as alterações.
        </p>
        <div className="connection-summary">
          <span className="local-dot" />
          <strong>
            {state.settings.mcpEnabled && state.settings.mcpWrite
              ? "Acesso local preparado"
              : "Integração ainda não preparada"}
          </strong>
          <p>
            {state.settings.mcpEnabled
              ? "A conexão com sua conta é verificada durante a configuração assistida."
              : "A configuração inicial é feita uma vez, com ajuda do assistente."}
          </p>
        </div>
        <p className="subtle">
          A preparação inicial é feita com o roteiro enviado por quem auxilia
          você. Depois, basta continuar sua conversa do TCC.
        </p>
        <details className="connection-repair">
          <summary>Precisa reconectar o ChatGPT?</summary>
          <p>
            Se a integração parar de funcionar, este pedido orienta o assistente
            a recuperar a instalação existente.
          </p>
          <button onClick={() => copyText("repair", repairPrompt)}>
            {copied === "repair" ? <Check size={14} /> : <Copy size={14} />}{" "}
            {copied === "repair"
              ? "Pedido copiado"
              : "Copiar pedido de reparo do MCP"}
          </button>
        </details>
        <details className="connection-access">
          <summary>Acesso ao conteúdo</summary>
          <p>
            Ao conectar, os trechos solicitados podem ser enviados ao ChatGPT.
            Seus arquivos e backups permanecem neste computador. O acesso inclui
            leitura e criação de conteúdo; revisões de texto existente continuam
            passando pela sua aprovação.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              mutate("update_settings", {
                mcpEnabled: !state.settings.mcpEnabled,
                mcpWrite: !state.settings.mcpEnabled,
              })
            }
          >
            {state.settings.mcpEnabled
              ? "Desativar integração"
              : "Autorizar leitura e escrita neste projeto"}
          </button>
        </details>
      </div>
      {(message || busy) && (
        <p className="notice" role="status">
          {busy ? "Processando…" : message}
        </p>
      )}
    </section>
  );
}
export function Welcome({
  state,
  mutate,
  onImport,
  onClose,
}: {
  state: State;
  mutate: Mutate;
  onImport: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="welcome">
      <BookIcon />
      <h2>Um espaço para o seu TCC.</h2>
      <p>
        Organize o trabalho, converse com o ChatGPT e revise cada mudança com
        tranquilidade. Seus arquivos ficam neste computador.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name"));
          setBusy(true);
          try {
            await mutate("update_settings", { name });
            for (const title of [
              "1. Introdução",
              "2. Referencial teórico",
              "3. Metodologia",
              "4. Resultados",
              "5. Considerações finais",
            ])
              await mutate("create_chapter", { title });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nome do projeto">
          <input name="name" defaultValue={state.name} required />
        </Field>
        <button className="primary" disabled={busy}>
          {busy ? "Preparando…" : "Começar com uma estrutura de capítulos"}
        </button>
      </form>
      <button className="text-button" onClick={onImport}>
        Importar meu LaTeX primeiro
      </button>
      <button className="text-button" onClick={onClose}>
        Começar com um projeto vazio
      </button>
      {error && <p role="alert">{error}</p>}
      <small>
        Backups automáticos ativos · conexão MCP inicialmente desligada
      </small>
    </div>
  );
}
function BookIcon() {
  return (
    <div className="welcome-icon">
      <FileText size={28} />
    </div>
  );
}

async function fileBase64(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error("O arquivo deve ter no máximo 8 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
