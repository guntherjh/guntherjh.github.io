# Lighthouse widget trend detail: a native-Popover toggletip, not a hover tooltip

The Lighthouse Widget's per-cell trend arrows (guntherjh/guntherjh.github.io#71) show only *that* a score's tier changed since the previous audit, not the earlier value. To surface "was 78 (needs improvement), now 95 (good)" without always painting it into ~28 cells (which would break the compact-table constraint from #41), arrows that mark a real tier change are wrapped in a `<button popovertarget>` using the native HTML Popover API, and the previous value lives in the associated `popover` element — opened on click/tap/Enter, dismissed on Escape or outside click, with **zero JavaScript**. Flat arrows stay plain text; the ↑/↓/– symbols themselves are explained once in the colour legend. Metric-column *definitions* are handled separately — a `<dl>` glossary behind a `<details>` disclosure under the table, with `aria-describedby` from each `<th>` so the definition reaches assistive tech even while the glossary is collapsed.

## Considered options

- **CSS-only `:hover`/`:focus` tooltip on a `tabindex="0"` span** — rejected: the table scrolls horizontally on narrow screens (a deliberate #41 choice; here scoped to a `.lighthouse-table-scroll` wrapper), and a scroll container clips any absolutely-positioned bubble escaping the cell. Working around it meant a media-query split of the overflow rule and betting on touch-focus behaviour.
- **A JS tooltip library, or hand-rolled JS for hover-to-open** — rejected: the repo's standards require HTML/CSS over JS and an explicit discussion for any dependency or non-trivial script; the Popover API covers the need natively.
- **Always-visible previous value inline in every cell** — rejected: ~28 extra strings in a table deliberately kept compact.
- **Hover-to-open** — rejected: not the Popover API's model without adding JS, and hover tooltips are unreachable on touch and awkward for keyboard. A click/tap "toggletip" is the accessible pattern.

## Consequences

- The trigger is a real `<button>` styled to look like the plain glyph — interactivity is signalled only by a pointer cursor and a `:focus-visible` ring, so the compact look is preserved but the affordance is subtle.
- The toggletip glyphs are `↑`/`↓` (thin arrows, not filled triangles), kept deliberately distinct from the `<details>` disclosure triangles used by the About page's collapsible sections and by the glossary itself.
- The panel is bottom-centred (`position: fixed`), not tethered to the arrow — CSS anchor positioning isn't broadly supported yet, and the top-layer panel would otherwise land at the viewport origin. The panel leads with its own metric and value ("Performance 100 (good)…") so it's unambiguous which arrow it belongs to.
- Browsers without Popover API support render the button inert (no visual popup); screen readers still get the full detail via `aria-describedby`, and the legend + `<dl>` still explain the symbols and metrics for everyone. Acceptable progressive enhancement.
- On an audit run with no tier changes there are no popover buttons at all — this feature surfaces *changes*, and previous raw values within an unchanged tier are not exposed to sighted users.
- Below 640px the 8-column table reflows (CSS-only, same markup) into one stacked card per page, each cell labelled from a `data-label` attribute — chosen over keeping the #41 horizontal scroll, which is hard on screen-magnifier and keyboard users. The cost: a `display:block` table loses its row/column semantics for some screen readers at that width; accepted because the content then fits a phone with no two-dimensional scrolling and every value stays labelled.

Metric definitions and thresholds are sourced in [docs/research/lighthouse-metric-definitions.md](../research/lighthouse-metric-definitions.md). guntherjh/guntherjh.github.io#124.
