# Shared selection controls

`src/components/ui/select.tsx` is installed from the official `@shadcn/select` registry with `npx shadcn@latest add @shadcn/select` (New York style, Radix base). Keep its implementation upstream-compatible; use the CLI diff when updating. `components.json` records the registry, aliases and CSS entry point.

`src/components/Select.tsx` is a compatibility adapter for existing value/option/form calls. It composes the official trigger (size sm), content, group, items and value. It does not implement the popup, focus, keyboard interactions, indicators or item spacing.

Tailwind v4 provides the component's actual utility styles. Its theme maps to the app's grayscale tokens. Preflight is intentionally omitted to preserve the existing editor/document styling. Utility priority isolates component sizing and padding from legacy global button rules; the context panel omits advanced filters through component composition. The app uses the official focus ring rather than stacking a custom outline on top. Reduced-motion preferences disable popup animation.

Validation: trigger horizontal inset 12px; menu item insets 8px left / 32px right and 6px vertical, reserving space for the selected indicator. Validate full-width fields, compact chapter status, comment filters and long labels in both themes whenever changing shared styles.

## Comment context and idea composer

Comment lists show the saved selection and the instruction together. Previews cap the selection at 220 Unicode characters / two lines and the comment at 320 characters / three lines. Explicit expand/collapse controls retain the full text; resize detection also enables expansion when narrow layouts clip a shorter string. Replies use 600-character previews. “Ir ao trecho” resolves stable document anchors, scrolls the document pane and highlights the target, including resolved comments. Missing or ambiguous targets keep the original quote and offer chapter navigation with an explanation instead of jumping to unrelated text. Marked selections keep their original paragraph geometry. Hover/focus opens a compact preview built with the official shadcn Popover and a virtual text-line anchor. Clicking or pressing Enter opens the selected comment in the sidebar, which retains the other comments. Dragging to select text does not open the sidebar. Previews dismiss on scroll and Escape; the sidebar uses a 200ms transition and disables motion when requested by the system.

The idea composer places a 200-character optional title before the content. Its underline replaces the boxed field; an empty/whitespace title saves as “Nova ideia”. The category control remains a standard official Select. Empty notebooks use an inline explanation; searches with no matches retain their filters so the user can recover.

“Copiar referência” copies a short human-readable reference plus the exact comment ID and MCP lookup instructions, without copying the academic text or comment body. `get_comment_context` accepts full IDs and unique `C-xxxxxxxx` references; ambiguous prefixes fail rather than selecting an arbitrary comment. Context includes project/chapter revisions, original quote, safely resolved current excerpt, replies, history and associated proposals.
