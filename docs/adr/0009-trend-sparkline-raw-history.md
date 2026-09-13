# Trend Sparkline: raw run history alongside the tier arrow, not instead of it

> **Scope narrowed by [guntherjh/guntherjh.github.io#158](https://github.com/guntherjh/guntherjh.github.io/issues/158):** Performance no longer gets a Trend Sparkline — its Score Donut already carries the current value, and a sparkline underneath it read as redundant. The mechanism and reasoning below are otherwise unchanged for the columns that keep one: LCP, CLS, and TBT.

The Lighthouse Widget draws a per-cell **Trend Sparkline** for LCP, CLS, and TBT — a faint line tracing that metric's raw value across the retained Lighthouse Snapshot history (guntherjh/guntherjh.github.io#151). This plots raw per-run values, which [ADR 0006](0006-lighthouse-snapshot-history.md) deliberately kept *off* the widget: real committed history shows a metric swinging by lab/network noise alone as much as a genuine regression would (e.g. TBT swinging 0ms→509ms between consecutive audits with no code change), so the existing ↑/↓/– indicator compares classified `good`/`average`/`poor` tiers, not raw deltas. The sparkline is added as a **secondary, sighted-only** view: the tier arrow and its toggletip ([ADR 0007](0007-trend-toggletip-native-popover.md)) remain the authoritative "did this actually change" signal and the only trend information exposed to assistive tech (the `<svg>` is `aria-hidden`). Two choices keep the raw line from re-introducing the noise problem ADR 0006 solved: it is drawn in a single muted `currentColor` stroke rather than threshold colors (context, not an alarm), and against a **fixed, threshold-anchored vertical domain** per metric (LCP 0–4000 ms; TBT 0–600 ms; CLS 0–0.25), with out-of-range points clamped — so a noisy run reads as a nearly flat line, not a mountain range. It renders only when at least two runs exist. ADR 0006 already anticipated this ("a deeper trend view remains possible later without another data-shape change"); no `src/_data/lighthouse.json` shape change was needed.

## Considered options

- **Replace the tier arrow with a raw sparkline** — rejected: throws away ADR 0006's noise handling and leaves assistive-tech users with no trend signal at all.
- **Auto-fit the sparkline's vertical scale to the data window** — rejected: makes every column's lab jitter fill the full height, exactly the misreading ADR 0006 exists to prevent.
- **Plot the classified tier as a 3-level step line** — rejected: noise-suppressed but a coarse, unfamiliar shape that duplicates what the arrow already says.

## Consequences

- The sparkline is decorative to screen readers; anyone relying on assistive tech gets the same trend information as before (the arrow), no more.
- Genuinely small real movements that stay within a fixed domain are visually flattened — an accepted cost of the anti-noise framing, consistent with ADR 0006.
- The SVG is generated at build time by a pure function in `eleventy.config.js` (`sparklineSvg`), unit-tested like `scoreLevel`/`trend`; no client JavaScript and no charting dependency were added. The **Score Donut** introduced in the same change is a reversible restyle of the existing per-cell color-coding and needs no ADR of its own.
