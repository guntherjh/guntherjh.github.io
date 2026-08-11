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
The About page component that renders the Strava Snapshot's data (recent Activities + Stats). Covers rendering only — distinct from the Strava Snapshot (the data) and the Refresh Job (how the data gets there). Not built from Strava's official embed/badge.
_Avoid_: badge, embed

**Strava Snapshot**:
The periodically-refreshed, build-time data artifact (recent public Activities + aggregate Stats) that the Strava Widget renders. Produced by the Refresh Job; consumed at Eleventy build time. Staleness on a failed refresh is acceptable — the previous Snapshot stays in place rather than breaking the build.
_Avoid_: cache, feed

**Refresh Job**:
The automated, scheduled process that authenticates with the Strava API and regenerates the Strava Snapshot, with no manual steps once set up.
_Avoid_: sync, cron (an implementation detail, not the concept)

**Activity** (Strava's own term):
A single logged Strava workout of any type (run, ride, swim, etc.). Only public Activities are eligible for the Strava Snapshot — never ones marked private on Strava.
_Avoid_: workout, entry

**Stats** (Strava's own term, short for "athlete stats"):
Aggregate high-level totals (e.g. distance, elevation, activity count) shown alongside the Activity list, as opposed to any single Activity's own detail.
_Avoid_: totals, summary
