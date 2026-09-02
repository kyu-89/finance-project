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
- Transaction card: the mobile `tds-ledger-table` card splits into a left/right region, three rows each, implemented as one 3-column grid (col 1 = left, cols 2–3 = the right region's own 2-column grid). Left has no field labels — it's the card's primary content, top to bottom: 유형 (colored by the income/expense rule, no label) · 금액 (headline number, larger/bolder, no label) · 내용 (title, self-evident, no label). Right is labeled and always 2 columns: row 1 성격 · 상태 (both dropdowns, at the top since they're the actionable controls), row 2 날짜 · 대분류, row 3 소분류 · 결제수단. A left border on the right region's first column draws the left/right divider. No icons. Column widths hug content (`max-content`) except the left column, which takes the remaining space. Editable status/behavior selects use a control height smaller than the app's standard 40px inline select, sized for this dense a card.
- States: selected uses the shared blue selected tokens. Pressed feedback may change color or shadow but must not move the target.
