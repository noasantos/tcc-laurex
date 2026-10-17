import { useRef, useState } from "react";
import {
  Lightbulb,
  CircleHelp,
  FlaskConical,
  ListTodo,
  BookOpen,
  Scale,
  Sparkles,
  ChevronDown,
  LoaderCircle,
  CornerDownLeft,
} from "lucide-react";
import type { Note } from "../../server/types";
import type { Mutate } from "./Review";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "./ui/input-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

const ideaTypes = [
  {
    name: "Pensamento",
    icon: Lightbulb,
    description: "Uma ideia para desenvolver depois",
  },
  {
    name: "Dúvida",
    icon: CircleHelp,
    description: "Uma pergunta que merece atenção",
  },
  {
    name: "Hipótese",
    icon: FlaskConical,
    description: "Uma possibilidade para investigar",
  },
  { name: "Tarefa", icon: ListTodo, description: "Algo que precisa ser feito" },
  {
    name: "Referência a investigar",
    icon: BookOpen,
    description: "Uma fonte para consultar",
  },
  {
    name: "Decisão acadêmica",
    icon: Scale,
    description: "Uma escolha e seus motivos",
  },
  {
    name: "Sugestão da IA",
    icon: Sparkles,
    description: "Uma proposta do ChatGPT para avaliar",
  },
];
export const categories = ideaTypes.map((type) => type.name);
export function NoteComposer({
  note,
  onCancel,
  mutate,
  projectRevision,
}: {
  note: Note | "new";
  onCancel: () => void;
  mutate: Mutate;
  projectRevision: number;
}) {
  const base = useRef(projectRevision);
  const form = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(note === "new" ? "" : note.title);
  const [content, setContent] = useState(note === "new" ? "" : note.content);
  const [category, setCategory] = useState(
    note === "new" ? "Pensamento" : note.category,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const selected =
    ideaTypes.find((type) => type.name === category) || ideaTypes[0];
  const Icon = selected.icon;
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  return (
    <form
      ref={form}
      className="note-composer"
      aria-label={note === "new" ? "Nova ideia" : "Editar ideia"}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key === "Enter" &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          form.current?.requestSubmit();
        }
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!content.trim() || submitting.current) return;
        submitting.current = true;
        setSaving(true);
        setError("");
        try {
          await mutate(note === "new" ? "create_note" : "update_note", {
            ...(note === "new"
              ? {}
              : { noteId: note.id, expectedRevision: base.current }),
            title: title.trim() || "Nova ideia",
            content,
            category,
          });
          onCancel();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          submitting.current = false;
          setSaving(false);
        }
      }}
    >
      <input
        className="note-composer-title"
        aria-label="Título da ideia"
        name="title"
        autoFocus
        maxLength={200}
        placeholder="Nova ideia"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
      />
      <InputGroup
        className="note-composer-writing"
        aria-label="Escrever e organizar ideia"
        data-disabled={saving}
      >
        <InputGroupTextarea
          aria-label="Sua ideia"
          name="content"
          required
          rows={4}
          maxLength={200000}
          disabled={saving}
          className="min-h-36 max-h-[min(44vh,360px)] px-4 py-4"
          placeholder="O que você quer guardar para depois?"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <InputGroupAddon
          align="block-end"
          className="note-composer-footer flex-wrap gap-2"
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <InputGroupButton
                size="sm"
                aria-label={`Tipo de ideia: ${category}`}
                disabled={saving}
              >
                <Icon data-icon="inline-start" />
                {category}
                <ChevronDown data-icon="inline-end" />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              collisionPadding={12}
              className="w-72 max-w-[calc(100vw-24px)]"
            >
              <DropdownMenuLabel>Tipo de ideia</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={category}
                onValueChange={setCategory}
              >
                {ideaTypes.map(({ name, icon: CategoryIcon, description }) => (
                  <DropdownMenuRadioItem
                    key={name}
                    value={name}
                    className="gap-3 py-1"
                  >
                    <CategoryIcon />
                    <span className="flex min-w-0 flex-col leading-4">
                      <span>{name}</span>
                      <span className="text-muted-foreground text-xs leading-4">
                        {description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="note-composer-actions">
            <InputGroupButton size="sm" disabled={saving} onClick={onCancel}>
              Cancelar
            </InputGroupButton>
            <InputGroupButton
              type="submit"
              size="sm"
              variant="default"
              disabled={saving || !content.trim()}
              title={`Guardar ideia (${shortcut}+Enter)`}
            >
              {saving && (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              )}
              {saving ? "Guardando…" : "Guardar ideia"}
              {!saving && <CornerDownLeft data-icon="inline-end" />}
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p className="error-text note-composer-error" role="alert">
          {error}
        </p>
      )}
      <p className="note-composer-caption">
        <span>Fica no caderno, separado do texto do TCC.</span>
        <span className="note-composer-shortcut">
          {shortcut} Enter para guardar
        </span>
      </p>
    </form>
  );
}
