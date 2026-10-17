import { useEffect, useRef, useState } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding.css";
import { request } from "../api";
import { stepIds, type Onboarding } from "../../server/onboarding-types";

export function useOnboarding() {
  const [value, setValue] = useState<Onboarding | null>(null);
  const [failure, setFailure] = useState("");
  const current = useRef(value);
  const queue = useRef(Promise.resolve());
  async function load() {
    try {
      const s = await request<Onboarding>("onboarding");
      current.current = s;
      setValue(s);
      setFailure("");
    } catch {
      setFailure(
        "Não foi possível carregar a apresentação. Seus documentos continuam disponíveis.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function update(event: string, extra: Record<string, string> = {}) {
    const run = queue.current.then(async () => {
      if (!current.current) throw new Error("Apresentação indisponível.");
      try {
        const s = await request<Onboarding>("onboarding", {
          expectedRevision: current.current.revision,
          event,
          ...extra,
        });
        current.current = s;
        setValue(s);
        return s;
      } catch (e) {
        await load();
        setFailure((e as Error).message);
        throw e;
      }
    });
    queue.current = run.then(
      () => {},
      () => {},
    );
    return run;
  }
  return { value, update, failure };
}
const titles = [
  "Encontre seu caminho",
  "Acompanhe seu trabalho",
  "Comente o trecho certo",
  "Guarde suas ideias",
  "Acompanhe suas revisões",
  "Seu espaço, do seu jeito",
];
const descriptions = [
  "Abra seus capítulos por aqui. Você pode manter o menu aberto ou recolhê-lo para ter mais espaço de leitura.",
  "Leia e revise o capítulo aqui. Quando você editar, acompanhe a indicação de salvamento.",
  "Selecione um trecho e escolha ‘Comentar’ para deixar uma observação ligada àquela parte do texto.",
  "Guarde ideias, dúvidas e tarefas sem misturá-las ao texto do TCC.",
  "Acompanhe comentários e mudanças propostas. Quando houver uma proposta, compare o antes e depois; aprovar e aplicar são decisões suas.",
  "Use a pesquisa para reencontrar conteúdo. Nas configurações, você encontra aparência, arquivos e informações da conexão com o Codex local. Você também pode fazer o tour novamente por lá.",
];
export const hintContent = [
  [
    "selection",
    "Ferramentas do trecho",
    "Use a barra da seleção para formatar e comentar o trecho. As opções disponíveis dependem do modo de edição.",
  ],
  [
    "proposal",
    "Revise cada mudança",
    "Compare o antes e depois. Aprovar uma proposta e aplicar a alteração são decisões separadas, feitas por você aqui.",
  ],
  [
    "reference",
    "Leve o contexto para a conversa",
    "Use ‘Copiar referência’ para identificar este comentário na sua conversa existente do TCC no Codex local. Só copiamos quando você clicar.",
  ],
  [
    "planning",
    "Planeje sem alterar o texto",
    "O planejamento reúne orientações para este capítulo e fica separado do texto acadêmico.",
  ],
  [
    "modes",
    "Escolha como ler",
    "Visual mostra o documento; Código LaTeX mostra a fonte; Lado a lado reúne as duas leituras.",
  ],
];
function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.closest("[inert], [hidden]"))
    return false;
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.top < innerHeight &&
    getComputedStyle(el).visibility !== "hidden"
  );
}
export function GuidedTour({
  activity,
  onboarding,
  eligible,
  hintsEligible,
  hasChapter,
  page,
  setPage,
  navigation,
  replay,
  replayHandled,
}: {
  activity: (active: boolean) => void;
  onboarding: ReturnType<typeof useOnboarding>;
  eligible: boolean;
  hintsEligible: boolean;
  hasChapter: boolean;
  page: string;
  setPage: (p: string) => void;
  navigation: (open: boolean) => void;
  replay: number;
  replayHandled: () => void;
}) {
  const { value, update, failure } = onboarding;
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const instance = useRef<Driver | null>(null);
  const generation = useRef(0);
  const preparing = useRef(false);
  const saved = useRef<{
    page: string;
    focus: HTMLElement | null;
    range: Range | null;
    scroll: [HTMLElement, string, number, number][];
  } | null>(null);
  const [hint, setHint] = useState<(typeof hintContent)[number] | null>(null);
  const [invitedThisVisit, setInvitedThisVisit] = useState(false);
  const activeRef = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  useEffect(() => {
    const check = () => {
      const next = Boolean(
        document.querySelector(
          '.note-composer, [data-onboarding-draft="true"], [role="dialog"]:not(.driver-popover), dialog[open]',
        ),
      );
      blockedRef.current = next;
      setBlocked(next);
    };
    const editing = (event: Event) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(
          ".driver-popover,.tour-invitation,.tour-hint,.ProseMirror,.cm-editor",
        )
      )
        target.closest("form")?.setAttribute("data-onboarding-draft", "true");
      check();
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-onboarding-draft", "open"],
    });
    document.addEventListener("input", editing, true);
    check();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", editing, true);
    };
  }, []);
  const isEligible = useRef(eligible);
  isEligible.current = eligible && !blocked;
  function finish() {
    setInvitedThisVisit(true);
    generation.current++;
    instance.current = null;
    activeRef.current = false;
    setActive(false);
    activity(false);
    navigation(false);
    const before = saved.current;
    saved.current = null;
    if (before) {
      setPage(before.page);
      requestAnimationFrame(() => {
        before.scroll.forEach(([el, key, x, y]) => {
          const target = el.isConnected
            ? el
            : document.querySelector<HTMLElement>(key);
          target?.scrollTo(x, y);
        });
        if (before.focus?.isConnected)
          before.focus.focus({ preventScroll: true });
        else
          document
            .querySelector<HTMLElement>('[aria-label="Configurações"]')
            ?.focus({ preventScroll: true });
        if (before.range?.startContainer.isConnected) {
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(before.range);
        }
      });
    }
  }
  function stop() {
    const current = instance.current;
    instance.current = null;
    current?.destroy();
    if (activeRef.current || saved.current) finish();
  }
  async function transition(index: number) {
    const ticket = ++generation.current;
    preparing.current = true;
    // Hide the old stage while routing or waiting for a lazy target.
    const previous = instance.current?.getState();
    if (previous?.popover) previous.popover.wrapper.hidden = true;
    if (previous?.__overlaySvg)
      previous.__overlaySvg.style.visibility = "hidden";
    setBusy(true);
    try {
      await update("progress", { step: stepIds[index] });
      if (ticket !== generation.current || !activeRef.current) return;
      navigation(
        index === 0 ||
          index === 3 ||
          index === 4 ||
          (index === 2 && !hasChapter),
      );
      if (index === 1 || index === 2) setPage("document");
      const target =
        index === 0
          ? "navigation"
          : index === 1
            ? hasChapter
              ? "editor"
              : "empty"
            : index === 2
              ? hasChapter
                ? "editor"
                : "comments"
              : index === 3
                ? "ideas"
                : index === 4
                  ? "reviews"
                  : "header";
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 6000;
        const check = () => {
          if (ticket !== generation.current) {
            resolve();
            return;
          }
          const el = document.querySelector(`[data-tour="${target}"]`);
          const navigation = el?.closest<HTMLElement>('[data-tour="navigation"]');
          const navigationBounds = navigation?.getBoundingClientRect();
          const navigationReady = !navigationBounds ||
            (navigationBounds.left >= 0 && navigationBounds.right <= innerWidth);
          if (
            visible(el) && navigationReady &&
            (target !== "editor" || el.querySelector('[data-hint="modes"]'))
          ) {
            resolve();
            return;
          }
          if (performance.now() > deadline) {
            reject(
              new Error(
                "Este recurso não está disponível agora. Você pode continuar a apresentação nas configurações.",
              ),
            );
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });
      if (ticket !== generation.current || !activeRef.current) return;
      const element = document.querySelector(`[data-tour="${target}"]`)!;
      if (!visible(element))
        throw new Error(
          "Recurso indisponível. Reabra a apresentação nas configurações.",
        );
      instance.current!.highlight({
        element,
        popover: {
          title: titles[index],
          description:
            index === 1 && !hasChapter
              ? "Crie seu primeiro capítulo ou importe seu projeto por estas ações. Seu documento ficará disponível depois disso."
              : descriptions[index],
          side: target === "header" ? "bottom" : "right",
          align: "start",
          progressText: `${index + 1} de 6`,
          showButtons:
            index === 0 ? ["next", "close"] : ["previous", "next", "close"],
          nextBtnText: index === 5 ? "Começar meu trabalho" : "Próximo",
          onNextClick: () => {
            if (index === 5)
              void update("complete")
                .then(stop)
                .catch(() => stop());
            else void transition(index + 1);
          },
          onPrevClick: () => {
            void transition(index - 1);
          },
          onCloseClick: () => {
            void update("dismiss")
              .then(stop)
              .catch(() => stop());
          },
        },
      });
      const current = instance.current?.getState();
      if (current?.popover) current.popover.wrapper.hidden = false;
      current?.__overlaySvg?.style.removeProperty("visibility");
    } catch (e) {
      setMessage((e as Error).message);
      stop();
    } finally {
      if (ticket === generation.current) preparing.current = false;
      setBusy(false);
    }
  }
  async function start(manual = false) {
    if (!eligible || blockedRef.current || activeRef.current) return;
    setMessage("");
    setHint(null);
    setBusy(true);
    try {
      await update("start");
      if (!isEligible.current || blockedRef.current) return;
      saved.current = {
        page,
        focus: document.activeElement as HTMLElement,
        range: window.getSelection()?.rangeCount
          ? window.getSelection()!.getRangeAt(0).cloneRange()
          : null,
        scroll: Array.from(
          document.querySelectorAll<HTMLElement>(
            "main, section, .document-body, .sidebar nav, .collection, .comments-body",
          ),
        ).map((el) => [
          el,
          el.id
            ? `#${CSS.escape(el.id)}`
            : el.dataset.tour
              ? `[data-tour="${el.dataset.tour}"]`
              : el.classList.length
                ? "." +
                  Array.from(el.classList)
                    .map((name) => CSS.escape(name))
                    .join(".")
                : el.tagName.toLowerCase(),
          el.scrollLeft,
          el.scrollTop,
        ]),
      };
      activeRef.current = true;
      setActive(true);
      activity(true);
      instance.current = driver({
        animate: false,
        smoothScroll: false,
        allowClose: true,
        allowKeyboardControl: true,
        overlayClickBehavior: "close",
        disableActiveInteraction: true,
        showProgress: true,
        popoverClass: "laurex-tour",
        closeBtnLabel: "Pular tour",
        prevBtnText: "Voltar",
        nextBtnText: "Próximo",
        onDestroyStarted: stop,
        onDestroyed: () => {
          if (activeRef.current) finish();
        },
        onPopoverRender: ({ wrapper, closeButton, nextButton }) => {
          closeButton.textContent = "Pular tour";
          closeButton.setAttribute("aria-label", "Pular tour");
          wrapper.setAttribute("aria-label", "Apresentação do LAUREX");
          nextButton.focus({ preventScroll: true });
        },
      });
      await transition(
        manual ? 0 : Math.max(0, stepIds.indexOf(value!.lastStep)),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (replay > 0 && eligible && !blocked) {
      replayHandled();
      void start(true);
    }
  }, [replay, eligible, blocked]);
  useEffect(() => {
    if ((!eligible || blocked) && activeRef.current) stop();
  }, [eligible, blocked]);
  useEffect(
    () => () => {
      generation.current++;
      instance.current?.destroy();
    },
    [],
  );
  useEffect(() => {
    if (!active) return;
    const observer = new MutationObserver(() => {
      const element = instance.current?.getActiveElement();
      if (!preparing.current && element && !element.isConnected) {
        setMessage(
          "Este recurso não está mais disponível. Reabra a apresentação nas configurações.",
        );
        stop();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (
      !value ||
      active ||
      !hintsEligible ||
      value.status === "not_started" ||
      value.status === "in_progress"
    ) {
      setHint(null);
      return;
    }
    const check = () => {
      const match = hintContent.find(
        ([id]) =>
          !value.hints.includes(id) &&
          Array.from(document.querySelectorAll(`[data-hint="${id}"]`)).some(
            visible,
          ),
      );
      setHint(match || null);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "hidden", "data-state"],
    });
    window.addEventListener("scroll", check, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", check, true);
    };
  }, [value, active, hintsEligible]);
  const invitation =
    value &&
    eligible &&
    !blocked &&
    !active &&
    !replay &&
    !busy &&
    !invitedThisVisit &&
    !failure &&
    ["not_started", "in_progress"].includes(value.status);
  return (
    <>
      {(failure || message) && (
        <div className="tour-notice" role="status">
          {message || failure}
        </div>
      )}
      {invitation && (
        <section
          className={
            "tour-invitation " +
            (value.status === "in_progress" ? "tour-resume" : "")
          }
          role="region"
          aria-label="Apresentação do LAUREX"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          }}
        >
          <h2>
            {value.status === "in_progress"
              ? "Continuar apresentação"
              : "Bem-vinda ao LAUREX"}
          </h2>
          <p>
            {value.status === "in_progress"
              ? "Retome de onde parou, quando quiser."
              : "Continue sua conversa do TCC no Codex local. Aqui você acompanha o trabalho, comenta trechos e revisa as mudanças."}
          </p>
          <div>
            <button className="primary" onClick={() => void start()}>
              {value.status === "in_progress"
                ? "Continuar apresentação"
                : "Conhecer meu espaço"}
            </button>
            <button
              onClick={() => {
                void update("dismiss").catch(() => {});
              }}
            >
              Agora não
            </button>
          </div>
        </section>
      )}
      {hint && !active && hintsEligible && (
        <aside
          className="tour-hint"
          role="note"
          aria-label={hint[1]}
          onMouseDown={(e) => e.preventDefault()}
        >
          <strong>{hint[1]}</strong>
          <p>{hint[2]}</p>
          <button
            onClick={() => {
              void update("hint", { hint: hint[0] }).catch(() => {});
            }}
          >
            Entendi<span className="sr-only">: {hint[1]}</span>
          </button>
        </aside>
      )}
    </>
  );
}
