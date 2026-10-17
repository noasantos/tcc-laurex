import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PanelLeft, PanelLeftClose, Pin } from "lucide-react";
import { Sidebar, SidebarProvider, useSidebar } from "./ui/sidebar";
import { Button } from "./ui/button";
import "./navigation.css";

export function NavigationWorkspace({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(() => {
    const saved = localStorage.getItem("laura-navigation-pinned");
    return saved === null ? window.innerWidth >= 768 : saved === "true";
  });
  const [peeking, setPeeking] = useState(false);
  const changePinned = (value: boolean) => {
    setPinned(value);
    setPeeking(false);
    localStorage.setItem("laura-navigation-pinned", String(value));
  };
  return (
    <SidebarProvider
      open={pinned || peeking}
      onOpenChange={changePinned}
      className="workspace navigation-workspace min-h-0"
      data-pinned={pinned}
      data-peeking={peeking}
      style={{ "--sidebar-width": "234px" } as CSSProperties}
    >
      <NavigationPanel
        pinned={pinned}
        peeking={peeking}
        setPeeking={setPeeking}
        setPinned={changePinned}
      >
        {navigation}
      </NavigationPanel>
      {children}
    </SidebarProvider>
  );
}

function NavigationPanel({
  pinned,
  peeking,
  setPeeking,
  setPinned,
  children,
}: {
  pinned: boolean;
  peeking: boolean;
  setPeeking: (value: boolean) => void;
  setPinned: (value: boolean) => void;
  children: ReactNode;
}) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const body = useRef<HTMLElement>(null);
  const edge = useRef<HTMLButtonElement>(null);
  const enter = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = isMobile ? openMobile : pinned || peeking;
  const clearTimers = () => {
    if (enter.current) clearTimeout(enter.current);
    if (leave.current) clearTimeout(leave.current);
  };
  const preview = () => {
    clearTimers();
    if (!isMobile && !pinned)
      enter.current = setTimeout(() => setPeeking(true), 140);
  };
  const dismissPreview = () => {
    clearTimers();
    if (!pinned && !isMobile)
      leave.current = setTimeout(() => {
        if (!body.current?.contains(document.activeElement)) setPeeking(false);
      }, 220);
  };
  const close = () => {
    clearTimers();
    if (isMobile) setOpenMobile(false);
    else setPinned(false);
    edge.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        peeking &&
        !body.current?.contains(event.target as Node) &&
        !edge.current?.contains(event.target as Node)
      )
        setPeeking(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        visible &&
        !event.defaultPrevented &&
        !body.current?.querySelector('[data-chapter-dragging="true"]')
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [peeking, visible, isMobile]);
  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (isMobile) setPeeking(false);
  }, [isMobile]);

  return (
    <>
      <div
        className="navigation-edge-zone"
        data-visible={visible}
        aria-hidden={visible}
        onPointerEnter={preview}
        onPointerLeave={dismissPreview}
      >
        <Button
          ref={edge}
          variant="ghost"
          size="icon-sm"
          className="navigation-edge-trigger"
          aria-label="Mostrar navegação"
          aria-controls="workspace-sidebar"
          aria-expanded={visible}
          title="Mostrar navegação"
          tabIndex={visible ? -1 : 0}
          onClick={() => {
            clearTimers();
            if (isMobile) setOpenMobile(true);
            else setPinned(true);
          }}
        >
          <PanelLeft />
        </Button>
      </div>
      <Sidebar className="navigation-panel" collapsible="offcanvas">
        <aside
          ref={body}
          className="sidebar navigation-body"
          id="workspace-sidebar"
          aria-label="Navegação do projeto"
          inert={!visible}
          onPointerEnter={clearTimers}
          onPointerLeave={dismissPreview}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              dismissPreview();
          }}
          onClickCapture={(event) => {
            if (
              (event.target as Element).closest("nav button") &&
              !(event.target as Element).closest("[data-chapter-drag-handle]")
            ) {
              if (isMobile) setOpenMobile(false);
              else if (!pinned) {
                clearTimers();
                setPeeking(false);
              }
            }
          }}
        >
          <div className="navigation-controls">
            {!isMobile && peeking && !pinned && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fixar navegação"
                title="Fixar navegação"
                onClick={() => {
                  clearTimers();
                  setPinned(true);
                }}
              >
                <Pin />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Recolher navegação"
              title="Recolher navegação"
              aria-controls="workspace-sidebar"
              aria-expanded={visible}
              onClick={close}
            >
              <PanelLeftClose />
            </Button>
          </div>
          {children}
        </aside>
      </Sidebar>
    </>
  );
}
