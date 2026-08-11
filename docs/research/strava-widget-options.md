# Research: Options for surfacing Strava activity/stats on a static site

**Research question:** What are the realistic options for surfacing "latest activities + high-level stats" from a personal Strava profile on a static site (Eleventy, GitHub Pages, no backend server)?

**Date researched:** 2026-08-11

**Scope note:** This is a fact-finding document. It does not make an implementation recommendation — that's a separate decision for a human to make using the facts below.

---

## 1. Official embed/widget

Strava has a **consumer-facing "Widget"/"Embed" feature** that is separate from the Developer API program. It requires no API key, no OAuth app, and no code beyond pasting an HTML snippet.

### 1a. Strava Widget (profile "Share your Rides/Runs")

- Generated from your own Strava profile page via a **"Share your Rides"** or **"Share your Runs"** link in the right-hand column, which opens a widget-options dialog with copyable embed code.
- Two widget types are offered:
  - **Activity Widget** — a list of your latest activities (e.g. latest runs/rides).
  - **Summary Widget** — a rollup of your stats for the current week.
- Widgets **only show activities matching your account's default sport type** — there's no way to configure which sport(s) show.
- No further visual customization beyond default sport type is documented.
- Privacy: activities must be visible to "Everyone" (and the profile itself must be public) for them to appear in the widget.
- No cost or "Powered by Strava" branding requirement is documented for this feature specifically (branding requirements that *do* exist apply to the separate API/Developer program, see §1c).

Source: [Strava Support — "Share your activities with a Strava Widget"](https://support.strava.com/hc/en-us/articles/216918527-Share-your-activities-with-a-Strava-Widget)

### 1b. Strava Embed (individual activity / route / profile-feed embed)

A related but distinct feature for embedding a **single activity**, a **route** (with optional 3D flyover), or a **profile/club activity feed**:

- Generated per-item: from the activity feed (arrow icon → "Embed") or an activity's detail page (share icon → "Embed"); for routes, from "My Routes" (⋯ menu → "Embed") or a route's detail page ("Duplicate" dropdown → "Embed").
- For a profile or club feed, the same "Share your Activities" / "Share Club Activities" buttons referenced in §1a expose an embed-code option.
- Displays maps, elevation profiles, activity lists, or performance summaries depending on embed type.
- Same privacy gating as the Widget: activity/route/profile must be set to "Everyone" visibility (some embed types also accept "Followers").
- Older/legacy embed URLs may stop working, per Strava's own note.

Source: [Strava Support — "Sharing Your Activities and Routes With a Strava Embed"](https://support.strava.com/en-us/articles/15402053-sharing-your-activities-and-routes-with-a-strava-embed)

Additional (secondary, Strava-owned partner site) how-tos for the same feature:
- [partners.strava.com — "How to Embed a Strava Activity"](https://partners.strava.com/resources/how-to-embed-a-strava-activity)
- [partners.strava.com — "How to Embed a Strava Route"](https://partners.strava.com/resources/how-to-embed-a-strava-route)

### 1c. Relationship to the Developer Portal

The main Developer Portal (`developers.strava.com`) landing page does **not** document or link to the Widget/Embed feature — it is oriented entirely around the OAuth2 API, app registration, API Playground, brand guidelines for *API-consuming apps*, the API Agreement/Policy, and an app directory. The Widget/Embed feature appears to be a plain profile feature of any Strava account, unrelated to registering a Developer API application.

Source: [developers.strava.com](https://developers.strava.com/) (fetched 2026-08-11; no widget/embed content found on this page)

**What this means for "latest activities + high-level stats":** the Widget/Embed feature can show a *recent activities list* and a *weekly summary*, but only for the account's default sport type, with no control over which fields/stats are shown (e.g., no way to show YTD or all-time totals — that's an API-only capability, see §2).

---

## 2. Strava API v3 basics (single personal account)

Primary source for this whole section: [developers.strava.com/docs/getting-started/](https://developers.strava.com/docs/getting-started/), [developers.strava.com/docs/authentication/](https://developers.strava.com/docs/authentication/), [developers.strava.com/docs/reference/](https://developers.strava.com/docs/reference/), [developers.strava.com/docs/rate-limits/](https://developers.strava.com/docs/rate-limits/).

### 2a. Auth model / "single-player mode"

- Strava API v3 uses **OAuth2**. The full flow is: athlete initiates login in your app → athlete authorizes scopes on Strava's site → Strava redirects back with an authorization code → app exchanges the code for an access token + refresh token via `POST https://www.strava.com/oauth/token`.
  Source: [Getting Started](https://developers.strava.com/docs/getting-started/), [Authentication](https://developers.strava.com/docs/authentication/)
- Strava explicitly documents a lighter path for a developer testing/using **their own account only**: a newly created app starts in what Strava calls **"single-player mode"**, where "only your own Strava account can authenticate with the app, which lets you build and test your integration against your own data" — i.e., you don't need a full multi-user consent flow if you are only ever going to authorize your own account. You still go through the OAuth authorize screen once, for yourself, to mint the initial token.
  Source: [Getting Started](https://developers.strava.com/docs/getting-started/)
- Creating a Developer API application at all now requires an active Strava subscription (see §2e — this is a 2026 change, not historically true).
- Scopes relevant here:
  - `read` — public segments, routes, profile, posts, events, club feeds, leaderboards
  - `activity:read` — the athlete's activities that are visible to Everyone/Followers (excludes privacy-zone data)
  - `activity:read_all` — same as `activity:read` plus privacy-zone and private activities
  - `profile:read_all` — full profile info regardless of privacy settings
  (also `profile:write`, `activity:write`, not relevant to a read-only "recent activities" surface)
  Source: [Authentication](https://developers.strava.com/docs/authentication/)

### 2b. Access token lifetime & refresh token rotation

- Access tokens **expire 6 hours after creation**.
- The refresh flow issues a new access token and **may issue a new refresh token value**; Strava's docs warn: "expect that this value can change anytime you retrieve a new access token. Once a new refresh token code has been returned, the older code will no longer work" — i.e. refresh tokens **rotate** and the caller must persist and use the newest one each time, not a fixed long-lived value.
- Both the old and new access token remain valid for use until they expire (grace period during rotation).
  Source: [Authentication](https://developers.strava.com/docs/authentication/)

### 2c. Relevant endpoints

**`GET /athlete/activities`** — the authenticated athlete's activities.
- Query params: `before` / `after` (epoch timestamp filters), `page` (default 1), `per_page` (default 30; the docs page as fetched did not state an explicit maximum — see Open Questions).
- Requires `activity:read` scope; "Only Me"-visibility activities are filtered out unless the token also carries `activity:read_all`.
- Returns an array of `SummaryActivity` objects; fields include (non-exhaustive) `name`, `type`, `sport_type`, `distance` (meters), `moving_time` / `elapsed_time` (seconds), `total_elevation_gain`, `start_date` / `start_date_local`, `kudos_count`, `comment_count`.
  Source: [API Reference](https://developers.strava.com/docs/reference/)

**`GET /athletes/{id}/stats`** — high-level athlete totals.
- Path param `id` must equal the authenticated athlete's own id (you cannot fetch another athlete's stats even if public).
- Only counts activities set to "Everyone" visibility.
- Returns an `ActivityStats` object with fields such as `recent_ride_totals`, `ytd_ride_totals`, `all_ride_totals` (and equivalents for run/swim), plus `biggest_ride_distance`, `biggest_climb_elevation_gain`.
  Source: [API Reference](https://developers.strava.com/docs/reference/)

### 2d. Rate limits

- **Overall default:** 200 requests / 15 minutes, 2,000 requests / day.
- **Non-upload default** (excludes POST activities/uploads/media): 100 requests / 15 minutes, 1,000 requests / day.
- 15-minute window resets at :00/:15/:30/:45 past the hour; daily limit resets at midnight UTC.
- Usage is reported via response headers `X-RateLimit-Limit` / `X-RateLimit-Usage` (overall) and `X-ReadRateLimit-Limit` / `X-ReadRateLimit-Usage` (non-upload), each a comma-separated `15min,daily` pair.
- Exceeding a limit returns `429 Too Many Requests`; requests that violate the short-term (15-min) limit still count against the daily limit.
- Strava's 2026 developer-program changes describe a **Standard Tier** with a self-upgrade path to "higher rate limits" (exact new numbers not stated in the announcement as fetched) once an app has ≥10 connected athletes, plus a separate, higher-limit **Extended Access Tier** for apps serving >10,000 users — not relevant to a single personal account but documented for completeness.
  Sources: [Rate Limits](https://developers.strava.com/docs/rate-limits/), [Strava Community Hub — "An Update To Our Developer Program"](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)

For a static-site build that fetches once (or a few times) per day/build, default limits are not a practical constraint.

### 2e. Cost — 2026 developer program change (important, recent)

As of the time of this research, Strava has changed its developer program to require payment:

- **June 1, 2026:** new two-tier system (Standard Tier / Extended Access Tier) introduced; new Standard Tier developers require an active Strava subscription starting this date.
- **June 30, 2026:** existing/active developers must also have a Strava subscription to continue Standard Tier API access. Developers without a current subscription at that point were offered a 3-month free transition code via email.
- The "subscription" required is the **regular consumer Strava subscription** (listed at **$11.99/month in the US**, price varies by country) — not a separate developer-specific fee stacked on top.
- Strava's stated rationale is curbing AI-company scraping and abuse of the free API.
- Other 2026 changes: three Club endpoints and the Segments Explore endpoint are slated for deprecation Sept 1, 2026; a token-format / API-URL migration is slated for June 1, 2027.

Source (first-party): [Strava Community Hub — "An Update To Our Developer Program"](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)

Secondary corroboration (press coverage, for context/cross-check only): [TechRepublic — "Strava Tightens API Access as AI Scraping Concerns Grow Ahead of IPO"](https://www.techrepublic.com/article/news-strava-api-scraping-crackdown/), [BigGo Finance — "Strava Slaps $12/Month Fee on API Access"](https://finance.biggo.com/news/202606011823_Strava_API_Fee_2026)

**This directly matters for the research question:** using the API v3 route (§2, and by extension the GitHub-Actions/serverless patterns in §3 that depend on it) now implies the site owner must be an active paying Strava subscriber to keep API access working, in addition to whatever hosting/build cost the static site itself has. The Widget/Embed feature in §1 does not appear to carry this requirement, since it is not part of the Developer API program.

### 2f. Data handling terms (API Agreement)

- The API Agreement reserves Strava's right to charge for API/platform access "in the future at our discretion" (now exercised, per §2e).
- On termination/revocation, the agreement requires that the developer "promptly cease using and permanently delete all the Strava API Materials ... and all Strava Data provided."
- The agreement requires "appropriate security measures" to protect data obtained from the API and compliance with applicable privacy law, but does **not** specify a maximum caching/retention duration for data while access is still active.
  Source: [Strava API Agreement](https://www.strava.com/legal/api)
- Separately, brand guidelines govern any voluntary "Powered by Strava" / "Compatible with Strava" logo use and general attribution language (e.g., always refer to the company as "Strava"), and note pass-through attribution obligations for any Garmin-sourced data displayed.
  Source: [Strava's brand guidelines](https://developers.strava.com/guidelines/), [Strava API Policy](https://www.strava.com/legal/api_policy)

---

## 3. Common integration patterns for a static site (no backend server)

These are documented from third-party examples (blog posts / open-source repos), since this is about common practice rather than an official Strava spec. Strava's own API-consumption model (§2) assumes *some* place to safely hold a `client_secret` and refresh token, which a static site cannot provide at request-serving time — the patterns below are different ways people work around that.

### 3a. GitHub Actions scheduled workflow → commit a JSON file → build reads it

**Pattern:** A `schedule`-triggered GitHub Actions workflow (cron) runs periodically, uses a stored `client_id`/`client_secret`/`refresh_token` (as GitHub Actions **secrets**) to call the Strava API, writes the result to a JSON file in the repo, and commits it (or triggers a rebuild/deploy of the static site, e.g. via a Pages-deploy action). The Eleventy build then reads that JSON file at build time like any other data file.

Examples observed:
- **Strava Backup GitHub Action** — runs on a schedule (e.g. every 3 days), fetches new activities, commits JSON files to an `activities/` directory. [GitHub Marketplace — "Strava Backup"](https://github.com/marketplace/actions/strava-backup)
- **Generic "Fetch API Data" GitHub Action** — makes an authenticated API request on a schedule and exposes the result as an env var and a `.json` file in the workspace "so they can be used in a static page without exposing your API credentials." [GitHub Marketplace — "Fetch API Data"](https://github.com/marketplace/actions/fetch-api-data)
- Blog walkthroughs of the same shape (cron workflow → write/commit JSON → static rebuild): [Aaron Saray — "Using Github Actions & Pages to Publish Static Pages Based on Dynamic Data"](https://aaronsaray.com/2021/github-actions-pages-scheduled-data-updates/), [James Ives — "Fetching Authenticated API Data with GitHub Actions"](https://jamesiv.es/blog/github/actions/2020/03/07/fetching-authenticated-api-data/)
- A more elaborate variant combining a Strava **webhook** (to trigger on new-activity events) with a small backend (Firestore-backed) plus a **separate** daily GitHub Actions cron job that snapshots YTD stats into a `ytdHistory.json` committed to the repo, consumed by a Netlify-built static site: [Curtis Timson — "Displaying Strava stats using webhooks & GitHub Actions"](https://www.curtiscode.dev/post/displaying-strava-stats-using-webhooks) (this example is a hybrid — it isn't a pure static-site-only pattern, since the webhook receiver needs a persistently running endpoint outside GitHub Actions).

**Tradeoffs implied for credentials:**
- `client_secret` and refresh token live only as CI secrets (e.g., GitHub Actions encrypted secrets), never shipped to the browser — this avoids the client-side exposure problem entirely.
- Because refresh tokens **rotate** (§2b), the workflow must write the newest refresh token back to the secret store (or persist it in the repo/elsewhere) each run, or the next scheduled run will fail once the old refresh token is invalidated.
- Data freshness is bounded by the schedule interval (e.g., daily/every-few-days), not real-time, unless combined with a webhook-triggered rebuild (which itself requires *some* always-on receiver, i.e., no longer "no backend server" in the purest sense).
- The committed JSON becomes part of the git history unless written to a branch/artifact that's excluded from history, which is a repo-hygiene consideration some of these examples don't address.

### 3b. Serverless function acting as an API proxy

**Pattern:** A serverless function (e.g., on a platform separate from the static host, or a platform's own functions product) holds the `client_secret`/refresh token as an environment variable and proxies requests from the client-side page to Strava, performing the OAuth token refresh server-side and returning just the needed data (or forwarding the Strava response) to the browser.

Example: [JamesRandall/StravaAPIProxy — "A CORS enabled API proxy for Strava that also supports their token exchange process"](https://github.com/JamesRandall/StravaAPIProxy) — client ID/secret can be read from environment variables in production rather than hardcoded.

**Why this pattern exists at all (per discussion in that repo and Strava's own developer community):** Strava's API does **not** enable CORS on its OAuth token-exchange endpoint, so a pure client-side page cannot perform the `client_secret`-bearing token exchange itself — "doing the token exchange in JavaScript would mean making the secret available in the source." A small always-on (or on-demand/serverless) endpoint with the secret is required to bridge that gap. Source: [JamesRandall/StravaAPIProxy issue #2 discussion](https://github.com/JamesRandall/StravaAPIProxy/issues/2), corroborated by Strava's own developer Google Group threads: [Strava API and CORS](https://groups.google.com/g/strava-api/c/YizXJN5EBM4), [Request: Enable CORS-related headers on the Strava API server](https://groups.google.com/g/strava-api/c/aFFa0UxdzIM).

**Tradeoffs implied for credentials:**
- Secret stays server-side (in the serverless platform's env-var store), never reaches the browser — same protection property as 3a.
- Unlike 3a, data can be fetched on-demand/live at page-view time rather than only at build time, at the cost of introducing a runtime dependency (the serverless function must be up) — which is a deviation from "no backend server," since a serverless function is a (thin, managed) backend.
- Introduces a second platform/account to manage (whichever serverless provider is used) beyond GitHub Pages, with its own uptime, quota, and possibly cost.
- The proxy itself becomes something that needs to enforce/respect Strava's rate limits if traffic to the site is significant, since each page view could trigger an API call unless the proxy also caches.

### 3c. Client-side fetch directly from the browser

**Pattern (why it doesn't fully work as a "no backend" solution):** A page's JavaScript calls the Strava API directly using a token embedded in the page or fetched some other way.

**Tradeoffs / why this is constrained:**
- The OAuth token-exchange call (`POST /oauth/token`, which needs `client_secret`) cannot be done from the browser without shipping the secret in client-side source, and Strava does not enable CORS for that endpoint specifically — this is confirmed by discussion in Strava's own developer community/Google Group threads cited above.
- Even if a long-lived access token were embedded directly (skipping the exchange step), access tokens expire every 6 hours (§2b) and would need to be refreshed, which again needs the secret.
- Community reports of CORS problems even on some read endpoints (e.g. activity streams) add further friction to a pure-browser approach: [Strava Community Hub — CORS problem fetching streams from browser](https://communityhub.strava.com/developers-api-7/activities-xxx-streams-cors-problem-when-fetching-from-browser-11257).
- Net effect: a pure client-side-only integration (no build step, no serverless function) is not really achievable for anything beyond a publicly embeddable widget (§1), because the API portion requires secret-holding somewhere.

---

## Open questions this doesn't resolve

- **Exact maximum `per_page` value for `GET /athlete/activities`.** The reference page as fetched stated only the default (30) and did not surface an explicit documented maximum in this pass of research; would need to be checked directly against the live Swagger/reference UI or by empirical testing.
- **Exact new rate-limit numbers for the 2026 "Standard Tier" / "Extended Access Tier."** Strava's community-hub announcement says Standard Tier can self-upgrade to "higher rate limits" and mentions a 10-athlete threshold, but does not give the new numeric limits; unclear whether a single-personal-account app would ever need or want to upgrade off the default tier.
- **Whether the Widget/Embed feature (§1) is affected by the 2026 subscription-for-API-access change at all.** All primary sourcing found treats Widget/Embed as a plain account feature separate from the Developer Portal, but this wasn't explicitly confirmed by a Strava statement addressing the overlap (or lack thereof) between the two.
- **Whether Strava's Widget/Embed data can include YTD/all-time stats, or only "current week" summaries.** The support docs describe the Summary Widget as showing "last week" of activity; whether any Widget/Embed configuration can show longer-window aggregates (as `/athletes/{id}/stats` can) was not found.
- **Any maximum data-caching/retention duration while API access remains active.** The API Agreement requires deletion on termination but does not appear to state a caching TTL for actively-authorized data (e.g., is it acceptable to keep committing a growing history file to a public git repo indefinitely?). This may be covered in the API Policy document (`https://www.strava.com/legal/api_policy`) in more depth than was reviewed here.
- **Precise dollar-equivalent subscription cost outside the US**, and whether a lower-cost annual plan would satisfy the "active Strava subscription" requirement for Standard Tier API access (the announcement says price "varies by country" but doesn't enumerate figures).
