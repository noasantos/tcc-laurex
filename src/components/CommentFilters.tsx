import {
  Search,
  FileText,
  Users,
  CalendarDays,
  ArrowDownUp,
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { TabsList, TabsTrigger } from "./ui/tabs";
import { InputGroup, InputGroupInput, InputGroupAddon } from "./ui/input-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./ui/dropdown-menu";
import type { Chapter } from "../../server/types";
function FilterMenu({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="comment-filter-trigger"
          aria-label={label + ": " + selected?.label}
          data-filtered={Boolean(value)}
        >
          <Icon data-icon="inline-start" />
          <span>{value ? selected?.label : label}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={12}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function CommentFilters({
  counts,
  chapters,
  chapterId,
  author,
  period,
  sort,
  search,
  compact,
  setChapter,
  setAuthor,
  setPeriod,
  setSort,
  setSearch,
}: {
  counts: { all: number; open: number; resolved: number };
  chapters: Chapter[];
  chapterId: string;
  author: string;
  period: string;
  sort: string;
  search: string;
  compact: boolean;
  setChapter: (v: string) => void;
  setAuthor: (v: string) => void;
  setPeriod: (v: string) => void;
  setSort: (v: string) => void;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="comments-toolbar">
      <TabsList
        variant="line"
        aria-label="Estado dos comentários"
        className="comment-status-tabs [.is-contextual_&]:w-full"
      >
        <TabsTrigger
          className="data-[state=active]:shadow-none [.is-contextual_&]:text-[10px] [.is-contextual_&]:px-1 [.is-contextual_&]:gap-1"
          value="all"
        >
          Todos <Badge variant="ghost">{counts.all}</Badge>
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:shadow-none [.is-contextual_&]:text-[10px] [.is-contextual_&]:px-1 [.is-contextual_&]:gap-1"
          value="open"
        >
          <span className="comment-state-dot" data-status="open" />
          Em aberto <Badge variant="ghost">{counts.open}</Badge>
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:shadow-none [.is-contextual_&]:text-[10px] [.is-contextual_&]:px-1 [.is-contextual_&]:gap-1"
          value="resolved"
        >
          <span className="comment-state-dot" data-status="resolved" />
          Concluídos <Badge variant="ghost">{counts.resolved}</Badge>
        </TabsTrigger>
      </TabsList>
      <div className="comment-filter-controls">
        <InputGroup className="comment-search border-0 shadow-none rounded-none">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Pesquisar comentários"
            placeholder="Pesquisar comentários…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        {!compact && (
          <div className="comment-filter-menus">
            <FilterMenu
              label="Capítulo"
              icon={FileText}
              value={chapterId}
              options={[
                { value: "", label: "Todos os capítulos" },
                ...chapters.map((c) => ({ value: c.id, label: c.title })),
              ]}
              onChange={setChapter}
            />
            <FilterMenu
              label="Autor"
              icon={Users}
              value={author}
              options={[
                { value: "", label: "Todos os autores" },
                { value: "Laura", label: "Laura" },
                { value: "ChatGPT", label: "ChatGPT" },
              ]}
              onChange={setAuthor}
            />
            <FilterMenu
              label="Período"
              icon={CalendarDays}
              value={period}
              options={[
                { value: "", label: "Todo o período" },
                { value: "today", label: "Últimas 24 horas" },
                { value: "week", label: "Últimos 7 dias" },
                { value: "month", label: "Últimos 30 dias" },
              ]}
              onChange={setPeriod}
            />
            <FilterMenu
              label="Ordenar"
              icon={ArrowDownUp}
              value={sort}
              options={[
                { value: "newest", label: "Mais recentes" },
                { value: "oldest", label: "Mais antigos" },
              ]}
              onChange={setSort}
            />
          </div>
        )}
      </div>
      {((chapterId && !compact) || author || period || search) && (
        <Button
          className="comment-clear-filters"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!compact) setChapter("");
            setAuthor("");
            setPeriod("");
            setSearch("");
          }}
        >
          <X data-icon="inline-start" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
