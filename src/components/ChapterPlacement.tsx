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
type Row = { id: string; title: string };
export function ChapterPlacement({
  chapters,
  title,
  position,
  onPositionChange,
  disabled,
}: {
  chapters: Row[];
  title: string;
  position: number;
  onPositionChange: (position: number) => void;
  disabled: boolean;
}) {
  const rows = [...chapters];
  rows.splice(position, 0, {
    id: draftId,
    title: title.trim() || "Novo capítulo",
  });
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
        Arraste o novo capítulo ou use as setas para escolher sua posição.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ over }) => {
          if (!disabled && over)
            onPositionChange(rows.findIndex((row) => row.id === over.id));
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
                move={onPositionChange}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <span className="sr-only" role="status">
        Novo capítulo na posição {position + 1} de {rows.length}.
      </span>
    </aside>
  );
}
function PlacementRow({
  row,
  index,
  count,
  disabled,
  move,
}: {
  row: Row;
  index: number;
  count: number;
  disabled: boolean;
  move: (position: number) => void;
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
      <span className="chapter-placement-number">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="chapter-placement-title">{row.title}</span>
      {draft && (
        <div className="chapter-placement-arrows">
          <button
            type="button"
            aria-label="Mover novo capítulo para cima"
            disabled={disabled || index === 0}
            onClick={() => move(index - 1)}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            aria-label="Mover novo capítulo para baixo"
            disabled={disabled || index === count - 1}
            onClick={() => move(index + 1)}
          >
            <ArrowDown size={13} />
          </button>
        </div>
      )}
    </li>
  );
}
