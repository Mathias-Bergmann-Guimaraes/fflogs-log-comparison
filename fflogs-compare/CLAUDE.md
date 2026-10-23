# fflogs-compare

Vue 3 + ant-design-vue 4 (dark theme) + Tailwind v4. Build UI from Ant components; Tailwind is for layout and spacing.

## UI layout rules (overlapping elements keep slipping through)

- **Never put a fixed width on an Ant input that has an addon** (`addon-before`, `addon-after`, `prefix`/`suffix` units such as "min" or "h").
  The class lands on the group wrapper, but the inner input keeps Ant's own minimum width (about 90px), so with a narrow
  width (`w-24!`, `w-28!`) the addon spills out over whatever sits next to it. Let Ant size it. If it really must be
  narrower or wider, wrap it in a sized `div` and check the result in the browser at that width.
- **Rows of controls wrap**: put inputs, labels and buttons in a row in `flex flex-wrap items-center gap-2`, never plain
  `flex` with fixed-width children. A row in a grid column or a card has less room than it looks in the code.
- **Don't fix the width of anything holding text or controls** (`w-*` on inputs, tags, labels in a row) unless it's a
  deliberate column. Use `min-w-*`/`max-w-*` instead, and `truncate` for text that may run long.
- Ant's styles beat plain Tailwind utilities on Ant elements (margins on `a-button`/`a-card`, colours on icons): use
  the `!` suffix or `:style` there, and check that it actually applied.
- Before calling a UI change done, picture the narrowest width it will get (a grid column, a table cell, a phone) and
  make sure nothing in it overlaps or overflows.
