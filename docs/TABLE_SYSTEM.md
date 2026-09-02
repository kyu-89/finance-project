# Table system

Desktop data tables use one reusable anatomy. Transaction lists use the
`tds-ledger-table` variant, so monthly input, transaction search, and future
ledger views share the same column contract.

- Wrap a wide table in `table-surface`. It contains horizontal scrolling inside the surface instead of allowing the page itself to overflow.
- Apply `tds-data-table` to the table. The shared rhythm is a 44px header, 64px minimum row, 16px horizontal cell inset, and 12px vertical cell inset.
- Existing tables inside standard scroll wrappers inherit the same surface, header, cell, and scroll behavior during migration; new tables must use `tds-data-table` directly.
- A header and its data rows must share the same column definition. Do not align tables through `nth-child` padding or one-off margins.
- Ledger columns are semantic tokens: date, state, type, behavior, category, subcategory, description, amount, and payment method. Their widths are defined once in `design-system.css`, not in feature CSS.
- Center short state values, right-align amounts with tabular numerals, and left-align categories, descriptions, and payment methods.
- Inline table selects use the shared 40px control height, radius, and padding. Equal controls must not vary by row.
- Dates and state controls reserve enough fixed column width to show their complete values. They do not wrap or truncate.
- Let the description column use only the remaining width. Long descriptions truncate on one line; dates, states, and amounts do not wrap.
