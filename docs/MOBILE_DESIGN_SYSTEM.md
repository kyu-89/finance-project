# Mobile design system

Mobile is a touch-first layout, not a scaled-down desktop screen.

- Breakpoint: phone rules apply at `767px` and below; component-specific phone exceptions use `640px` only when a two-column layout must collapse.
- Page gutter: `--ui-mobile-gutter` (16px). Page sections use the shared 20px rhythm.
- Touch controls: primary actions, inputs, selects, and drawer triggers use `--ui-mobile-control-height` (48px). Dense inline status controls are the sole 40px exception.
- Fixed regions: bottom navigation reserves `--ui-mobile-bottom-nav-height` plus the safe-area inset. Toasts and scrollable page content must use the same reservation.
- Drawer: full-width bottom sheet, maximum 88dvh, 20px top radius, safe-area-aware body padding.
- Tables: transform transaction ledgers into labeled cards on phones. Other dense data tables scroll only inside their table surface; the page never gains horizontal scrolling.
- Typography: interactive fields use 16px to avoid mobile browser zoom. Supporting text is 13px or larger; do not truncate dates, status labels, or currency values.
- Required fields: the `FormField` label is the single source of truth. Show `필수` immediately after the label text in red; do not use positioned label pseudo-elements.
- Transaction card: the mobile `tds-ledger-table` card packs its short facts (date, status, type, behavior, category, subcategory, payment method) onto as few lines as their own content needs — fields size to their content (`flex: 0 0 auto`), never a fixed 50/50 split. Only description (the card's title) and amount (its headline number) each claim a full line, in that order, after the packed facts; visual order is set with `order` and does not depend on column/DOM order. Static cells are 32px minimum; editable status and behavior cells retain the 40px compact control height and a minimum tap width so their `select` never collapses.
- States: selected uses the shared blue selected tokens. Pressed feedback may change color or shadow but must not move the target.
