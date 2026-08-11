# guntherjh.github.io

Personal site for John Henry Gunther — a Home/About/Blog site rebuilt with Eleventy, replacing the 2017 single-page resume.

## Language

**Page**:
A top-level, non-chronological section of the site (Home, About, Blog index).
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
The About page's subsection covering career history (work experience, education, skills) and contact information.
_Avoid_: CV, Resume page

**Strava Widget**:
The About page component showing Strava data — Strava's own hosted Activity Widget and/or Summary Widget, embedded via Strava's provided snippet. Not a custom-built component consuming our own fetched data; Strava serves and controls its content directly.
_Avoid_: badge, Strava Snapshot, Refresh Job (both retired — see [Strava Widget: data spec #24](https://github.com/guntherjh/guntherjh.github.io/issues/24) Decisions so far for why)
