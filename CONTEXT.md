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

**Strava Widget**:
The About page component rendering the Strava Snapshot — the last 5 Activities and per-sport recent Stats. A custom-built component consuming fetched data (not Strava's own embed — that route was tried and found non-functional, see [Strava Widget: data spec #24](https://github.com/guntherjh/guntherjh.github.io/issues/24) Decisions so far).
_Avoid_: badge, embed

**Strava Snapshot**:
The data artifact (`src/_data/strava.json`) the Strava Widget renders — the last 5 Activities plus per-sport recent (last 4 weeks) Stats, produced by the Refresh Job and committed to `master`. Staleness on a failed run is acceptable — the previous Snapshot stays in place rather than breaking the build. Freshness is tied to a daily schedule, not merge activity (contrast with the Lighthouse Snapshot).
_Avoid_: results, report

**Refresh Job**:
The automated, daily-scheduled GitHub Actions workflow (`.github/workflows/strava-refresh.yml`) that authenticates with the Strava API and regenerates the Strava Snapshot, with no manual steps once set up — including handling Strava's OAuth refresh-token rotation on every run.
_Avoid_: sync, cron (an implementation detail, not the concept)

**Activity** (Strava's own term):
A single logged Strava workout of any type (run, ride, swim, etc.). Only public Activities are eligible for the Strava Snapshot — never ones marked private on Strava. No social metrics (kudos, comments) are included.
_Avoid_: workout, entry

**Stats** (Strava's own term, short for "athlete stats"):
Aggregate per-sport totals (count, distance, moving time, elevation gain) over Strava's "recent" (last 4 weeks) window — not a single blended total across sport types, and not year-to-date or all-time.
_Avoid_: totals, summary
