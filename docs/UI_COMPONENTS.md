# Shared selection controls

`src/components/ui/select.tsx` is installed from the official `@shadcn/select` registry with `npx shadcn@latest add @shadcn/select` (New York style, Radix base). Keep its implementation upstream-compatible; use the CLI diff when updating. `components.json` records the registry, aliases and CSS entry point.

`src/components/Select.tsx` is a compatibility adapter for existing value/option/form calls. It composes the official trigger (size sm), content, group, items and value. It does not implement the popup, focus, keyboard interactions, indicators or item spacing.

Tailwind v4 provides the component's actual utility styles. Its theme maps to the app's grayscale tokens. Preflight is intentionally omitted to preserve the existing editor/document styling. Utility priority isolates component sizing and padding from legacy global button rules; the context panel's intentionally omitted advanced filters remain hidden. The app uses the official focus ring rather than stacking a custom outline on top. Reduced-motion preferences disable popup animation.

Validation: trigger horizontal inset 12px; menu item insets 8px left / 32px right and 6px vertical, reserving space for the selected indicator. Validate full-width fields, compact chapter status, comment filters and long labels in both themes whenever changing shared styles.
