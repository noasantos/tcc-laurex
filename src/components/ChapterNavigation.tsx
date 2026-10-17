import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chapter } from "../../server/types";
import "./chapter-navigation.css";

export function ChapterNavigation({
  chapters,
  revision,
  selectedId,
  onNavigate,
  onReorder,
}: {
  chapters: Chapter[];
  revision: number;
  selectedId: string;
  onNavigate: (id: string) => void;
  onReorder: (ids: string[], revision: number) => Promise<unknown>;
}) {
  const [order, setOrder] = useState(() => chapters.map((c) => c.id));
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const baseRevision = useRef(revision);
  const latest = useRef(chapters);
  latest.current = chapters;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (!dragging && !saving) setOrder(chapters.map((c) => c.id));
  }, [chapters, dragging, saving]);
  const visible = order
    .map((id) => chapters.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c);
  // Include externally created chapters without choosing a new order during a drag.
  for (const chapter of chapters)
    if (!order.includes(chapter.id)) visible.push(chapter);
  async function drop({ active, over }: DragEndEvent) {
    setDragging(false);
    if (!over || active.id === over.id) return;
    const ids = visible.map((c) => c.id);
    const from = ids.indexOf(String(active.id)),
      to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    setSaving(true);
    try {
      await onReorder(next, baseRevision.current);
    } catch {
      setOrder(latest.current.map((c) => c.id));
    } finally {
      setSaving(false);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => {
        baseRevision.current = revision;
        setDragging(true);
      }}
      onDragEnd={drop}
      onDragCancel={() => setDragging(false)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para reordenar um capítulo, pressione Espaço, use as setas e pressione Espaço novamente. Escape cancela.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Capítulo ${chapters.find((c) => c.id === active.id)?.title} selecionado para ordenar.`,
          onDragOver: ({ over }) =>
            over
              ? `Posição ${visible.findIndex((c) => c.id === over.id) + 1} de ${visible.length}.`
              : undefined,
          onDragEnd: ({ over }) =>
            over ? "Nova ordem definida." : "Ordenação cancelada.",
          onDragCancel: () => "Ordenação cancelada.",
        },
      }}
    >
      <SortableContext
        items={visible.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="chapter-nav sortable-chapters"
          aria-label="Capítulos em ordem"
          aria-busy={saving}
          data-chapter-dragging={dragging}
        >
          {visible.map((chapter) => (
            <SortableChapter
              key={chapter.id}
              chapter={chapter}
              selected={selectedId === chapter.id}
              disabled={saving || chapters.length < 2}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
function SortableChapter({
  chapter,
  selected,
  disabled,
  onNavigate,
}: {
  chapter: Chapter;
  selected: boolean;
  disabled: boolean;
  onNavigate: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: chapter.id,
    disabled,
    transition: { duration: 200, easing: "cubic-bezier(.22,1,.36,1)" },
  });
  return (
    <div
      ref={setNodeRef}
      className={
        "sortable-chapter" +
        (selected ? " selected" : "") +
        (isDragging ? " is-dragging" : "")
      }
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="chapter-drag-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-chapter-drag-handle
        aria-label={`Reordenar capítulo: ${chapter.title}`}
        title="Arraste para reordenar · Espaço e setas pelo teclado"
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical size={13} />
      </button>
      <button
        className="chapter-nav-item"
        aria-current={selected ? "page" : undefined}
        style={{ paddingLeft: chapter.parentId ? 18 : 4 }}
        onClick={() => onNavigate(chapter.id)}
        title={chapter.title}
      >
        {chapter.title}
      </button>
    </div>
  );
}
