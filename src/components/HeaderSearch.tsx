import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  FileText,
  MessageSquare,
  NotebookPen,
  Library,
  ArrowUpRight,
} from "lucide-react";
import type { State } from "../../server/types";
import { searchProject, type SearchResult } from "../search";
const icons = {
  chapter: FileText,
  comment: MessageSquare,
  note: NotebookPen,
  reference: Library,
};
export function HeaderSearch({
  state,
  onSelect,
}: {
  state: State;
  onSelect: (result: SearchResult) => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    shell = useRef<HTMLDivElement>(null);
  const listId = useId();
  const results = useMemo(() => searchProject(state, query), [state, query]);
  function close() {
    setExpanded(false);
    setActive(-1);
  }
  function select(result: SearchResult) {
    onSelect(result);
    close();
  }
  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(listId + "-" + active)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);
  return (
    <Popover.Root open={expanded} onOpenChange={setExpanded} modal={false}>
      <Popover.Anchor asChild>
        <div
          ref={shell}
          className={"header-search " + (expanded ? "expanded" : "")}
        >
          <button
            ref={trigger}
            className="header-search-icon"
            aria-label="Pesquisar"
            title="Pesquisar no projeto"
            aria-expanded={expanded}
            aria-controls={listId + "-popup"}
            onClick={() => {
              setExpanded(true);
              input.current?.focus();
            }}
          >
            <Search />
          </button>
          <div className="header-search-input-wrap">
            <input
              ref={input}
              tabIndex={expanded ? 0 : -1}
              aria-hidden={!expanded}
              role="combobox"
              aria-label="Pesquisar no projeto"
              aria-autocomplete="list"
              aria-haspopup="dialog"
              aria-expanded={expanded}
              aria-controls={listId + "-popup"}
              aria-activedescendant={
                active >= 0 ? listId + "-" + active : undefined
              }
              placeholder="Pesquisar no projeto…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                  trigger.current?.focus();
                } else if (
                  (e.key === "ArrowDown" || e.key === "ArrowUp") &&
                  results.length
                ) {
                  e.preventDefault();
                  setActive((current) =>
                    e.key === "ArrowDown"
                      ? (current + 1) % results.length
                      : current <= 0
                        ? results.length - 1
                        : current - 1,
                  );
                } else if (e.key === "Enter" && results.length) {
                  e.preventDefault();
                  select(results[active >= 0 ? active : 0]);
                }
              }}
            />
          </div>
          {expanded && (
            <button
              className="header-search-clear"
              aria-label={query ? "Limpar pesquisa" : "Fechar pesquisa"}
              title={query ? "Limpar pesquisa" : "Fechar pesquisa"}
              onClick={() => {
                if (query) {
                  setQuery("");
                  setActive(-1);
                  input.current?.focus();
                } else {
                  close();
                  trigger.current?.focus();
                }
              }}
            >
              <X />
            </button>
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="header-search-dropdown"
          id={listId + "-popup"}
          align="end"
          sideOffset={9}
          collisionPadding={12}
          aria-label="Busca no projeto"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (shell.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {!query.trim() ? (
            <div className="search-guidance">
              <strong>Reencontre algo do seu trabalho</strong>
              <p>
                Pesquise uma palavra, um autor ou uma ideia que você discutiu.
              </p>
              <div>
                <FileText />
                <span>
                  <b>Texto e capítulos</b>
                  <small>Trechos do TCC e planejamento</small>
                </span>
              </div>
              <div>
                <MessageSquare />
                <span>
                  <b>Comentários e ideias</b>
                  <small>Pedidos de revisão, dúvidas e decisões</small>
                </span>
              </div>
              <div>
                <Library />
                <span>
                  <b>Fontes bibliográficas</b>
                  <small>Títulos, autores, ano ou DOI</small>
                </span>
              </div>
              <p className="search-local-hint">
                A pesquisa acontece neste projeto, sem enviar sua busca à
                internet.
              </p>
            </div>
          ) : (
            <>
              <div className="search-results-heading" role="status">
                {results.length
                  ? `${results.length}${results.length === 30 ? "+" : ""} resultado${results.length === 1 ? "" : "s"} no projeto`
                  : "Tente outra palavra ou um termo mais curto."}
              </div>
              <div
                id={listId}
                className="header-search-results"
                role="listbox"
                aria-label="Resultados da pesquisa"
              >
                {results.map((result, index) => {
                  const Icon = icons[result.kind];
                  return (
                    <div
                      key={result.kind + result.id}
                      id={listId + "-" + index}
                      role="option"
                      aria-selected={active === index}
                      tabIndex={-1}
                      className="header-search-result"
                      onPointerMove={() => setActive(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(result)}
                    >
                      <Icon />
                      <div>
                        <small>{result.label}</small>
                        <strong>{result.title}</strong>
                        {result.excerpt && <p>{result.excerpt}</p>}
                      </div>
                      <ArrowUpRight />
                    </div>
                  );
                })}
              </div>
              {!results.length && (
                <p className="search-no-match">
                  Você pode procurar por parte de uma frase, pelo nome de um
                  capítulo ou pelo sobrenome de um autor.
                </p>
              )}
            </>
          )}
          <footer>
            <span>↑ ↓ navegar · Enter abrir</span>
            <span>Esc fechar</span>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
