# guntherjh.github.io

Personal site for John Henry Gunther — a Home/About/Blog site rebuilt with Eleventy, replacing the 2017 single-page resume.

## Language

**Page**:
A top-level, non-chronological section of the site (Home, About, Resume, Blog index).
_Avoid_: Section

**Post**:
A dated, chronological entry in the Blog. Distinct from a Page.
_Avoid_: Article, entry

**About Me**:
The About page's subsection introducing who the site owner is, outside of career history.
_Avoid_: Bio (as a section name), intro

**About this site**:
The About page's subsection describing the site itself — what it's built with and why it exists. Distinct from About Me.
_Avoid_: Colophon, meta section

**Resume**:
Its own top-level Page (not an About subsection) covering career history: Work Experience, Education, Skills, and Contact. Linked from the nav and from a short pointer on the About page.
_Avoid_: CV, About's Resume subsection (retired — Resume is no longer nested under About)

**Lighthouse Widget**:
The About page's "This site" subsection's display of the Lighthouse Snapshot — category scores (Performance, Accessibility, Best Practices, SEO) and lab Core Web Vitals proxies (LCP, CLS, TBT) for Home, About, Resume, and the Blog index. A compact grid, not prose, matching the site's data-dense visual direction.
_Avoid_: score badge, performance widget

**Lighthouse Snapshot**:
The data artifact (e.g. `src/_data/lighthouse.json`) the Lighthouse Widget renders — one Lighthouse Audit per tracked Page, captured against the real production URL after a merge to `master` and the resulting Pages deploy finish. Staleness on a failed run is acceptable — the previous Snapshot stays in place rather than breaking the build. Freshness is tied to merge activity only, no separate scheduled refresh.
_Avoid_: results, report

**Lighthouse Audit** (Google's own term):
A single Lighthouse run against one URL, producing the four category scores plus lab performance metrics (FCP, LCP, TBT, CLS, Speed Index). Distinct from true field Core Web Vitals (e.g. real-user INP) — a single Audit is a synthetic lab run, not a measurement of real visitor sessions.
_Avoid_: report, scan
