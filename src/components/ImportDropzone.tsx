import { useRef, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileCheck2,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

export type ImportResult = { message: string; pending?: boolean };
export function ImportDropzone({
  disabled,
  onImport,
  resetKey = 0,
}: {
  disabled: boolean;
  resetKey?: number;
  onImport: (file: File) => Promise<ImportResult>;
}) {
  const [status, setStatus] = useState<
    "idle" | "busy" | "success" | "pending" | "error"
  >("idle");
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const importing = useRef(false);
  useEffect(() => {
    setStatus("idle");
    setFilename("");
    setMessage("");
  }, [resetKey]);
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept: {
        "text/plain": [".tex", ".bib"],
        "application/zip": [".zip"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
      },
      multiple: false,
      maxFiles: 1,
      maxSize: 8 * 1024 * 1024,
      disabled: disabled || status === "busy",
      onDropRejected: (rejections) => {
        if (importing.current) return;
        setStatus("error");
        setFilename("");
        setMessage(
          rejections.some((r) =>
            r.errors.some((e) => e.code === "file-too-large"),
          )
            ? "O arquivo deve ter até 8 MB."
            : rejections.some((r) =>
                  r.errors.some((e) => e.code === "too-many-files"),
                )
              ? "Selecione um arquivo por vez."
              : "Este formato não é compatível. Use .tex, .bib, .docx ou .zip.",
        );
      },
      onDropAccepted: async (files) => {
        if (importing.current) return;
        const file = files[0];
        if (!file) return;
        if (!/\.(tex|bib|docx|zip)$/i.test(file.name)) {
          setStatus("error");
          setFilename("");
          setMessage(
            "Este formato não é compatível. Use .tex, .bib, .docx ou .zip.",
          );
          return;
        }
        importing.current = true;
        setFilename(file.name);
        setStatus("busy");
        setMessage("");
        try {
          const result = await onImport(file);
          setStatus(result.pending ? "pending" : "success");
          setMessage(result.message);
        } catch (error) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível importar. Tente novamente.",
          );
        } finally {
          importing.current = false;
        }
      },
    });
  const Icon =
    status === "busy"
      ? LoaderCircle
      : status === "success"
        ? FileCheck2
        : status === "error"
          ? AlertCircle
          : UploadCloud;
  return (
    <div className="import-upload">
      <div
        {...getRootProps({
          role: "button",
          "aria-label": "Importar arquivo acadêmico",
          "aria-describedby": "import-formats",
          "aria-disabled": disabled || status === "busy",
          className:
            "import-dropzone " +
            (isDragActive ? "is-dragging " : "") +
            (isDragReject ? "is-rejected " : "") +
            (status === "busy" ? "is-busy" : ""),
        })}
      >
        <input
          {...getInputProps({ "aria-label": "Escolher arquivo acadêmico" })}
        />
        <span
          className={
            "import-upload-icon " + (status === "busy" ? "is-spinning" : "")
          }
          aria-hidden="true"
        >
          <Icon size={23} />
        </span>
        <strong>
          {status === "busy"
            ? "Importando seu arquivo…"
            : isDragActive
              ? isDragReject
                ? "Este arquivo não é compatível"
                : "Solte o arquivo aqui"
              : "Arraste seu arquivo para cá"}
        </strong>
        <span className="import-upload-prompt">
          {status === "busy" ? (
            filename
          ) : (
            <>
              ou <span>clique para escolher no computador</span>
            </>
          )}
        </span>
        <span className="import-formats" id="import-formats">
          LaTeX .tex <i /> BibTeX .bib <i /> Word .docx <i /> Projeto .zip
          <span>Um arquivo por vez · até 8 MB</span>
        </span>
      </div>
      <div
        className={"import-feedback " + status}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {status !== "idle" && status !== "busy" && (
          <>
            <strong>{filename || "Arquivo não importado"}</strong>
            <span>{message}</span>
          </>
        )}
      </div>
    </div>
  );
}
