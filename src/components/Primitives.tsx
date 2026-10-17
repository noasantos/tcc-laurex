import { Select } from "./Select";
import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useId,
  useState,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
import { diffWords } from "diff";
import type { Doc } from "../../server/types";
import { plain } from "../../server/types";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLElement>(
        '[autofocus],textarea,input:not([type="file"]),[role="combobox"]',
      )
      ?.focus();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
    >
      <header>
        <h2 id={headingId}>{title}</h2>
        <button aria-label="Fechar" className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement<{ "aria-label"?: string }>(children) &&
      children.type === Select
        ? cloneElement(children, {
            "aria-label": children.props["aria-label"] || label,
          })
        : children}
    </label>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Diff({ before, after }: { before: Doc; after: Doc }) {
  return (
    <div className="diff">
      <div className="compare-columns">
        <section>
          <h4>Antes</h4>
          <p>{plain(before) || "Sem texto"}</p>
        </section>
        <section>
          <h4>Depois</h4>
          <p>{plain(after) || "Sem texto"}</p>
        </section>
      </div>
      <h4>Alterações</h4>
      <p>
        {diffWords(plain(before), plain(after)).map((p, i) =>
          p.added ? (
            <ins key={i}>{p.value}</ins>
          ) : p.removed ? (
            <del key={i}>{p.value}</del>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </p>
    </div>
  );
}
export const date = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

export type AnchorRect = {
  left: number;
  top: number;
  bottom: number;
  right?: number;
};
export function SidePanel({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const headingId = useId();
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(
        'textarea,input:not([type="file"]),[role="combobox"]',
      )
      ?.focus();
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        ref.current?.contains(e.target as globalThis.Node)
      )
        onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  return (
    <aside
      ref={ref}
      className={"side-sheet " + (wide ? "wide" : "")}
      aria-labelledby={headingId}
    >
      <header>
        <h2 id={headingId}>{title}</h2>
        <button
          aria-label="Fechar painel"
          className="icon-button"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="side-sheet-body">{children}</div>
    </aside>
  );
}
export function ContextPopover({
  title,
  children,
  onClose,
  anchor,
  width = 360,
  dismissOnOutside = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  anchor?: AnchorRect;
  width?: number;
  dismissOnOutside?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [position, setPosition] = useState({
    left: Math.max(
      12,
      Math.min(
        anchor?.left ?? window.innerWidth - width - 24,
        window.innerWidth - width - 12,
      ),
    ),
    top: Math.min(
      anchor?.bottom ? anchor.bottom + 10 : 88,
      window.innerHeight - 250,
    ),
  });
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({
        left: Math.max(
          12,
          Math.min(
            anchor?.left ?? window.innerWidth - width - 24,
            window.innerWidth - rect.width - 12,
          ),
        ),
        top: Math.max(
          12,
          Math.min(
            anchor?.bottom ? anchor.bottom + 10 : 88,
            window.innerHeight - rect.height - 12,
          ),
        ),
      });
      el.querySelector<HTMLElement>(
        'textarea,input:not([type="file"]),[role="combobox"]',
      )?.focus();
    }
    const outside = (e: PointerEvent) => {
      if (
        dismissOnOutside &&
        !ref.current?.contains(e.target as globalThis.Node) &&
        !(e.target as Element)?.closest?.("[data-select-content]")
      )
        close.current();
    };
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !(e.target as Element)?.closest?.("[data-select-content]")
      )
        close.current();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="context-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      style={{ left: position.left, top: position.top, width }}
    >
      <header>
        <h2 id={headingId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar caixa contextual"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      <div className="popover-body">{children}</div>
    </div>
  );
}
