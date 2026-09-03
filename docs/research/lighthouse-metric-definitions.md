# Research: Lighthouse widget metric definitions and thresholds

Date: 2026-09-03

Scope: canonical, citable definitions and good/needs-improvement/poor
thresholds for the seven metric columns the Lighthouse Widget shows on the
About page — the four category scores (Performance, Accessibility, Best
Practices, SEO) and the three lab metrics (LCP, CLS, TBT) — so the glossary
`<dl>` and colour legend added for guntherjh/guntherjh.github.io#124 quote
primary sources rather than folk knowledge. No recommendation here; facts
only.

The numbers below also cross-check the thresholds already hard-coded in
`eleventy.config.js` (`METRIC_THRESHOLDS`, `scoreLevel`) — they match, and
this document is where that match is now sourced from.

---

## Category scores (0–100)

All four category scores share the same colour banding, set by Lighthouse
itself:

- **Green / good: 90–100**
- **Orange / needs improvement: 50–89**
- **Red / poor: 0–49**

> "To provide a good user experience, sites should strive to have a good
> score (90–100)."

([Lighthouse performance scoring — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)).
`scoreLevel` in `eleventy.config.js` (`>= 90` good, `>= 50` average, else
poor) matches this exactly.

### Performance

A weighted average of five lab metric scores, each mapped from its raw
value through a log-normal curve calibrated against HTTP Archive field
data. Lighthouse 10 weights:

| Metric | Weight |
|---|---|
| First Contentful Paint | 10% |
| Speed Index | 10% |
| Largest Contentful Paint | 25% |
| Total Blocking Time | 30% |
| Cumulative Layout Shift | 25% |

([performance-scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)).
The widget surfaces LCP, TBT and CLS as their own columns; FCP and Speed
Index feed the Performance score but aren't shown separately.

### Accessibility

A weighted average of ~50+ automated checks (Lighthouse runs axe-core).
Each audit is **binary pass/fail — no partial credit** — and audits are
weighted by axe-core's impact rating (heaviest, 10 points: valid ARIA,
image `alt`, form-field labels, video captions; lighter 3–7 points:
heading order, landmarks). A perfect score does **not** mean the page is
fully accessible — automated tooling can't catch every barrier, so manual
testing is still required.

([Lighthouse Accessibility scoring — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)).

### Best Practices

A set of general web-quality and security checks, **all weighted
equally**: HTTPS and HSTS, no browser-console errors, no deprecated APIs,
a valid HTML doctype, correct charset, images served at their natural
aspect ratio, `rel="noopener"` on cross-origin links, a Content Security
Policy, no vulnerable JS libraries, no permission requests on load.

([Lighthouse Best Practices audits — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/best-practices/)).

### SEO

Basic technical-SEO checks, **weighted equally** (except the manual
"structured data is valid" audit): page is crawlable (`robots.txt` valid,
not blocked), has a `<title>` and a non-empty meta description, returns a
successful HTTP status, uses descriptive link text, valid `hreflang` and
`canonical`, tap targets sized appropriately. This is a fundamentals
check, **not a comprehensive SEO audit** — it doesn't judge content
quality or strategy.

([Lighthouse SEO audits — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/seo/)).

---

## Lab metrics

### LCP — Largest Contentful Paint

> "the render time of the largest image, text block, or video visible in
> the viewport, relative to when the user first navigated to the page."

Considered elements: `<img>`, `<image>` inside `<svg>`, `<video>` poster,
elements with a CSS `url()` background image, and block-level elements
containing text. Invisible elements, full-viewport overlays and
placeholder images are excluded.

| Rating | Threshold |
|---|---|
| Good | ≤ 2.5 s |
| Needs improvement | 2.5 s – 4.0 s |
| Poor | > 4.0 s |

Thresholds are evaluated at the 75th percentile of page loads, split by
mobile and desktop.
([Largest Contentful Paint (LCP) — web.dev](https://web.dev/articles/lcp)).
Matches `METRIC_THRESHOLDS.lcp` (`good: 2500`, `average: 4000` ms).

### CLS — Cumulative Layout Shift

Measures visual instability — "the largest burst of layout shift scores
for every unexpected layout shift that occurs during the entire lifecycle
of a page." A layout shift is a visible element changing position between
two rendered frames. Per shift: `layout shift score = impact fraction ×
distance fraction`, where impact fraction is the viewport area affected by
unstable elements and distance fraction is the largest distance one moved
relative to the viewport's largest dimension. Unitless.

| Rating | Threshold |
|---|---|
| Good | ≤ 0.1 |
| Needs improvement | 0.1 – 0.25 |
| Poor | > 0.25 |

Evaluated at the 75th percentile, split by mobile and desktop.
([Cumulative Layout Shift (CLS) — web.dev](https://web.dev/articles/cls)).
Matches `METRIC_THRESHOLDS.cls` (`good: 0.1`, `average: 0.25`).

### TBT — Total Blocking Time

> "the total amount of time that a page is blocked from responding to user
> input, such as mouse clicks, screen taps, or keyboard presses."

Summed over long tasks (any task > 50 ms) between First Contentful Paint
and Time to Interactive, counting only the portion of each task beyond
50 ms (a 70 ms task contributes 20 ms). A lab proxy for interaction
readiness, not a field Core Web Vital itself.

Lighthouse scoring thresholds (**mobile** — what this repo's audit uses):

| Rating | Threshold |
|---|---|
| Good | 0 – 200 ms |
| Needs improvement | 200 – 600 ms |
| Poor | > 600 ms |

(Desktop scoring uses a tighter 0–150 / 150–350 / >350 ms curve.)
([Total Blocking Time (TBT) — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time)).
Matches `METRIC_THRESHOLDS.tbt` (`good: 200`, `average: 600` ms).

---

## Open questions this doesn't resolve

- Lighthouse metric weights and the log-normal scoring curves change
  between major versions (the weights above are stated for Lighthouse 10);
  the audit job doesn't pin a Lighthouse major, so the exact Performance
  weighting can drift under it. The colour bands (90 / 50) and the three
  lab-metric thresholds have been stable across recent versions.
- web.dev states CWV thresholds against 75th-percentile *field* data; a
  single Lighthouse lab run is one synthetic sample, not a percentile —
  the widget applies the same cut points to a lab number, which is how
  Lighthouse's own report colours them too but isn't what the percentile
  language literally describes.
