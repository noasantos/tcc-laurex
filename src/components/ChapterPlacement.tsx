import {
  previewChapterPlacement,
  maximumChapterNumber,
} from "../../server/chapter-numbering";
import { ArrowDown, ArrowUp, FileText, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
const draftId = "new-chapter-placement";
type Row = { id: string; title: string; number?: number };
export function ChapterPlacement({
  chapters,
  title,
  number,
  onNumberChange,
  disabled,
}: {
  chapters: Row[];
  title: string;
  number: string;
  onNumberChange: (number: string) => void;
  disabled: boolean;
}) {
  const value = Number(number);
  const safeNumber =
    Number.isInteger(value) && value >= 1 && value <= maximumChapterNumber
      ? value
      : Math.max(0, ...chapters.map((c, i) => c.number ?? i + 1)) + 1;
  const rows = previewChapterPlacement(
    chapters,
    { id: draftId, title: title.trim() || "Novo capítulo" },
    safeNumber,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <aside
      className="chapter-order-preview"
      aria-label="Posição do novo capítulo"
    >
      <h2>
        <FileText size={14} /> Ordem dos capítulos
      </h2>
      <p className="chapter-placement-help" id="chapter-placement-help">
        Edite o número, use as setas ou arraste o capítulo. Pode criar o 6 antes
        do 5.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ over }) => {
          if (!disabled && over && over.id !== draftId) {
            const from = rows.findIndex((row) => row.id === draftId),
              to = rows.findIndex((row) => row.id === over.id);
            const target = chapters.find((c) => c.id === over.id);
            if (target)
              onNumberChange(
                String(
                  (target.number ?? chapters.indexOf(target) + 1) +
                    (from < to ? 1 : 0),
                ),
              );
          }
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pressione Espaço para mover o novo capítulo, use as setas e Espaço para confirmar. Escape cancela.",
          },
          announcements: {
            onDragStart: () => "Novo capítulo selecionado para mover.",
            onDragOver: ({ over }) =>
              over
                ? `Posição ${rows.findIndex((row) => row.id === over.id) + 1} de ${rows.length}.`
                : undefined,
            onDragEnd: ({ over }) =>
              over
                ? "Posição do novo capítulo definida."
                : "Movimento cancelado.",
            onDragCancel: () => "Movimento cancelado.",
          },
        }}
      >
        <SortableContext
          items={rows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol>
            {rows.map((row, index) => (
              <PlacementRow
                key={row.id}
                row={row}
                index={index}
                count={rows.length}
                disabled={disabled}
                number={number}
                move={onNumberChange}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <span className="sr-only" role="status">
        Novo capítulo com número {safeNumber}.
      </span>
    </aside>
  );
}
function PlacementRow({
  row,
  index,
  count,
  number,
  disabled,
  move,
}: {
  row: Row;
  index: number;
  count: number;
  number: string;
  disabled: boolean;
  move: (number: string) => void;
}) {
  const draft = row.id === draftId;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: { draggable: disabled || !draft, droppable: false },
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        position: "relative",
      }}
      className={(draft ? "is-new " : "") + (isDragging ? "is-dragging" : "")}
    >
      {draft ? (
        <button
          type="button"
          className="chapter-placement-grip"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label="Arrastar novo capítulo"
          aria-describedby="chapter-placement-help"
        >
          <GripVertical size={14} />
        </button>
      ) : (
        <span className="chapter-placement-spacer" />
      )}
      {draft ? (
        <input
          className="chapter-number-input"
          aria-label="Número do novo capítulo"
          inputMode="numeric"
          type="number"
          min={1}
          max={maximumChapterNumber}
          value={number}
          onChange={(e) => move(e.target.value)}
          disabled={disabled}
          aria-invalid={
            !Number.isInteger(Number(number)) ||
            Number(number) < 1 ||
            Number(number) > maximumChapterNumber
          }
        />
      ) : (
        <span className="chapter-placement-number">
          {String(row.number).padStart(2, "0")}
        </span>
      )}
      <span className="chapter-placement-title">{row.title}</span>
      {draft && (
        <div className="chapter-placement-arrows">
          <button
            type="button"
            aria-label="Mover novo capítulo para cima"
            disabled={disabled || Number(number) <= 1}
            onClick={() => move(String(Math.max(1, Number(number) - 1)))}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            aria-label="Mover novo capítulo para baixo"
            disabled={disabled || Number(number) >= maximumChapterNumber}
            onClick={() => move(String(Number(number) + 1))}
          >
            <ArrowDown size={13} />
          </button>
        </div>
      )}
    </li>
  );
}
