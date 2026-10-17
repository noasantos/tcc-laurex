# Shared selection controls

`src/components/ui/select.tsx` is installed from the official `@shadcn/select` registry with `npx shadcn@latest add @shadcn/select` (New York style, Radix base). Keep its implementation upstream-compatible; use the CLI diff when updating. `components.json` records the registry, aliases and CSS entry point.

`src/components/Select.tsx` is a compatibility adapter for existing value/option/form calls. It composes the official trigger (size sm), content, group, items and value. It does not implement the popup, focus, keyboard interactions, indicators or item spacing.

Tailwind v4 provides the component's actual utility styles. Its theme maps to the app's grayscale tokens. Preflight is intentionally omitted to preserve the existing editor/document styling. Utility priority isolates component sizing and padding from legacy global button rules; the context panel omits advanced filters through component composition. The app uses the official focus ring rather than stacking a custom outline on top. Reduced-motion preferences disable popup animation.

Validation: trigger horizontal inset 12px; menu item insets 8px left / 32px right and 6px vertical, reserving space for the selected indicator. Validate full-width fields, compact chapter status, comment filters and long labels in both themes whenever changing shared styles.

## Comment context and idea composer

Comment lists show the saved selection and the instruction together. Previews cap the selection at 220 Unicode characters / two lines and the comment at 320 characters / three lines. Explicit expand/collapse controls retain the full text; resize detection also enables expansion when narrow layouts clip a shorter string. Replies use 600-character previews. “Ir ao trecho” resolves stable document anchors, scrolls the document pane and highlights the target, including resolved comments. Missing or ambiguous targets keep the original quote and offer chapter navigation with an explanation instead of jumping to unrelated text. Marked selections keep their original paragraph geometry. Hover/focus opens a compact preview built with the official shadcn Popover and a virtual text-line anchor. Clicking or pressing Enter opens the selected comment in the sidebar, which retains the other comments. Dragging to select text does not open the sidebar. Previews dismiss on scroll and Escape; the sidebar uses a 200ms transition and disables motion when requested by the system.

The idea composer places a 200-character optional title before the content. Its underline replaces the boxed field; an empty/whitespace title saves as “Nova ideia”. The category control remains a standard official Select. Empty notebooks use an inline explanation; searches with no matches retain their filters so the user can recover.

“Copiar referência” copies a short human-readable reference plus the exact comment ID and MCP lookup instructions, without copying the academic text or comment body. `get_comment_context` accepts full IDs and unique `C-xxxxxxxx` references; ambiguous prefixes fail rather than selecting an arbitrary comment. Context includes project/chapter revisions, original quote, safely resolved current excerpt, replies, history and associated proposals.

## Navigation sidebar

The navigation uses the official `@shadcn/sidebar` (New York/Radix, installed by CLI), including its provider, offcanvas layout and mobile Sheet. `NavigationWorkspace` adds separate pinned and temporary-hover states. Hover never claims a layout gap; only explicit pinning reserves width. A narrow left-edge activation area uses 140ms hover intent and a 220ms exit grace period. Pointer traversal into the menu cancels dismissal; selecting a destination dismisses a temporary preview. The visible controls live inside the navigation, never in the app header.

The scoped layout uses a transform-only 260ms `cubic-bezier(.22,1,.36,1)` slide and the same timing for the pinned layout gap. No display toggle or unmount interrupts the desktop slide; hidden navigation is inert. Reduced motion removes the transitions. The only behavioral patch to the upstream provider preserves Cmd/Ctrl+B inside text inputs and contenteditable editors instead of intercepting bold formatting. Mobile uses the official sidebar Sheet behavior. The pin preference is local; hover does not persist as a preference.

References: [official Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar), [Notion sidebar controls](https://www.notion.com/help/navigate-with-the-sidebar).

## Chapter creation and native source

Creating a chapter opens a dedicated screen in the main area, with an independent title, optional planning, insertion position and a live flat outline. No side sheet or parent selector is involved. Creation inserts the chapter atomically at a validated position; metadata organization remains separate.

The source view uses the official CodeMirror 6 packages and the upstream TeX stream mode, loaded lazily. Native TeX is persisted on the server; the pane never substitutes a regenerated visual projection for the source. Segmented view controls provide visual, code-only and split layouts. See [LATEX.md](LATEX.md) for canonical source, conservative visual limits and scroll mapping. References: [CodeMirror language infrastructure](https://github.com/codemirror/language), [official TeX mode](https://github.com/codemirror/legacy-modes/blob/main/mode/stex.js).

Chapter navigation composes the official dnd-kit Sortable preset: a dedicated grip appears on row hover/focus, drag activation requires 5px of movement, neighboring rows shift with a 200ms easing, and the order is saved on drop. The title remains a separate navigation button. Space + arrows + Space provides keyboard sorting; Escape cancels. Reduced motion disables the row transition. Reordering sends the revision captured at drag start; conflicts roll back the optimistic order and preserve the latest server state. Grips do not dismiss the temporary hover navigation. [Sortable documentation](https://dndkit.com/legacy/presets/sortable/overview/).

## Exact aligned reading

Split reading has one vertical scroller, with actual rendered wrap boundaries and font baselines shared between visual text and monospace source rows. The source map comes from AST/literal source offsets, not a percentage or a block-height interpolation. ProseMirror replaces nodes while updating decorations; each measurement reacquires the current nodes instead of caching detached DOM. Font probes and KaTeX struts provide the actual baselines. A ResizeObserver and font-load events refresh layout; hidden/unmounted views release observers and temporary CSS spacing. Original code is unchanged. Mismatches show an explicit original-code action, never an approximate fallback. Native source-only lines reserve matching visual space; tables/figures remain atomic. See LATEX.md for the distinction between aligned presentation and original physical source lines.
