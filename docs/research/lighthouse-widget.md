# Research: Lighthouse widget for the About page

Date: 2026-08-12

Scope: facts needed to decide how to add a widget on the About page showing
Lighthouse category scores (Performance/Accessibility/Best Practices/SEO,
0-100) and LCP/CLS/TBT for four pages of the live production site
(https://johnhenrygunther.com) — Home, About, Resume, Blog index — audited
from GitHub Actions after each merge to `master`, with results written to a
committed JSON data file the Eleventy build reads. No recommendation is made
here — facts only, so a human can decide.

This repo's actual current workflows, for reference:

- `.github/workflows/deploy.yml` — triggers on `push: branches: [master]`
  (plus `workflow_dispatch`). Single workflow file, two jobs: `build` (checks
  out, `npm ci`, `npm run build`, `actions/configure-pages@v5`,
  `actions/upload-pages-artifact@v3`) and `deploy` (`needs: build`, uses
  `actions/deploy-pages@v4`, `environment: github-pages` with
  `url: ${{ steps.deployment.outputs.page_url }}`). Permissions:
  `contents: read`, `pages: write`, `id-token: write`. This confirms the repo
  uses the GitHub Pages "GitHub Actions" source (not "Deploy from a branch").
- `.github/workflows/checks.yml` — triggers on `pull_request: branches:
  [master]` only, runs `check` (`npm run check`) and `build` jobs. Does not
  touch `master` pushes.

---

## 1. Tool choice: running Lighthouse against live URLs from a GitHub Actions job

### (a) `treosh/lighthouse-ci-action`

- **What it is**: a GitHub Marketplace action wrapping Google's own
  `@lhci/cli` (Lighthouse CI), preinstalling Chrome and Lighthouse in the
  runner image
  ([README](https://github.com/treosh/lighthouse-ci-action)).
- **Setup complexity**: low. Minimal YAML — a `urls` input takes a
  newline-separated list, no server or build step required for already-live
  external URLs:
  ```yaml
  urls: |
    https://example.com/
    https://example.com/blog
  ```
  ([README](https://github.com/treosh/lighthouse-ci-action)).
- **Targeting an already-live external URL with no extra config**: yes —
  passing full external URLs in `urls` works directly; the alternative
  `staticDistDir` input (which spins up a local static webserver to audit an
  unpublished build) is a separate, opt-in mode, not required
  ([README](https://github.com/treosh/lighthouse-ci-action)).
- **JSON output shape**: the action exposes three GitHub Actions step
  outputs — `resultsPath` (directory of raw per-URL Lighthouse JSON
  reports), `links` (JSON map of URL → uploaded HTML report link), and
  `manifest` (JSON array with per-URL summary). The `manifest` output looks
  like:
  ```json
  [
    {
      "url": "https://treo.sh/",
      "isRepresentativeRun": true,
      "htmlPath": "...report.html",
      "jsonPath": "...report.json",
      "summary": {
        "performance": 0.99,
        "accessibility": 0.98,
        "best-practices": 1,
        "seo": 0.96,
        "pwa": 0.71
      }
    }
  ]
  ```
  ([README](https://github.com/treosh/lighthouse-ci-action)). This gives the
  four category scores directly, but as **0–1 fractions, not 0–100** (simple
  `× 100` needed), and **does not** include LCP/CLS/TBT — those numeric
  values only exist inside the raw per-URL JSON report file referenced by
  `jsonPath`/`resultsPath`, i.e. an extra parse of the full Lighthouse
  Result (LHR) JSON is required to get Core Web Vitals numbers.
- **Maintenance**: latest release `12.6.2`, published 2026-03-12 (per
  GitHub's own Releases API,
  `https://api.github.com/repos/treosh/lighthouse-ci-action/releases`) —
  roughly 5 months old at time of writing. Actively tagged with major
  version aliases (`v12`, `v11`, etc.).

### (b) Google's own `@lhci/cli` (`lighthouse-ci`)

- **What it is**: the official Google Chrome team CLI/toolkit for automating
  Lighthouse in CI, of which `treosh/lighthouse-ci-action` above is a thin
  GitHub Actions wrapper
  ([GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)).
- **Setup complexity**: moderate — no GitHub Actions wrapper is provided
  natively, so it must be installed (`npm install -g @lhci/cli`) and invoked
  manually (typically `lhci autorun` or `lhci collect` + `lhci assert` +
  `lhci upload`) inside a hand-written workflow step
  ([getting-started.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)).
- **Targeting an already-live external URL with no extra config**: yes, via
  the `url` config array in `lighthouserc.js`/`.json`
  (`collect: { url: ['https://example.com/'] }`). The docs' primary
  walkthrough defaults to `staticDistDir` or `startServerCommand` (for
  locally built/served sites), with pointing at already-deployed URLs
  documented separately as "Sites with a Custom Server" —
  `url: ['http://localhost:3000/'], startServerCommand: 'rails server -e
  production'` — the same `url` option works unchanged for a fully external
  production URL with no `startServerCommand` needed
  ([getting-started.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)).
- **JSON output shape**: `lhci collect` writes raw Lighthouse Result (LHR)
  JSON files to `.lighthouseci/`, the same underlying format the plain
  `lighthouse` CLI produces (see 1c) — i.e. category scores at
  `categories.<id>.score` (0–1) and metrics at
  `audits['largest-contentful-paint'].numericValue` etc. `lhci` itself adds
  no separate simplified schema on top of the raw LHR for `collect`; the
  `assert`/`upload` subcommands add pass/fail and diffing structures.
  Getting clean 0–100 scores and LCP/CLS/TBT numbers still requires parsing
  the same underlying LHR JSON documented in Lighthouse's own repo (see 1c).
- **Maintenance**: latest release `v0.15.1`, published 2025-06-26 (per
  GitHub's own Releases API,
  `https://api.github.com/repos/GoogleChrome/lighthouse-ci/releases`) —
  roughly 14 months old at time of writing, noticeably staler than the
  `lighthouse` core package and the `treosh` action's own release cadence.

### (c) Plain `lighthouse` npm CLI (`npx lighthouse <url> --output json`)

- **What it is**: Google's own Lighthouse core project/CLI
  ([GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse)).
- **Setup complexity**: lowest dependency footprint — `npm install -g
  lighthouse` (or `npx lighthouse`) and run directly; no action, no
  `lighthouserc` config file required for a one-off audit. Requires **Node
  22 (LTS) or later**, per the project's own README
  ([readme.md](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md))
  — note this repo currently pins Node 20 in both workflow files
  (`.github/workflows/deploy.yml`, `.github/workflows/checks.yml`), so a
  Node bump (or a separate job with a different `node-version`) would be
  needed to use a current `lighthouse` release.
- **Targeting an already-live external URL with no extra config**: yes —
  the CLI's own basic usage example is exactly this pattern,
  `lighthouse https://airhorner.com/`
  ([readme.md](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md)).
  `--output json` sends the full JSON report to stdout, or
  `--output-path` writes it to disk.
- **JSON output shape**: this is the canonical Lighthouse Result (LHR)
  format that both `lhci` and (indirectly) `treosh/lighthouse-ci-action`'s
  raw per-URL reports are built from. Per Lighthouse's own
  `docs/understanding-results.md`:
  - Category scores: `categories[categoryId].score`, "provided in the
    numeric range `0-1`" — needs `× 100` to get 0–100.
  - Individual audits (metrics): `audits[auditId]`, each with a `score`
    (0–1 or null) and a `numericValue` — "the unscored value determined by
    the audit... for performance audits, this value is typically a number
    indicating the metric value." LCP is `audits['largest-contentful-paint'].numericValue`
    (milliseconds), CLS is `audits['cumulative-layout-shift'].numericValue`
    (unitless), TBT is `audits['total-blocking-time'].numericValue`
    (milliseconds)
    ([understanding-results.md](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/docs/understanding-results.md)).
  - This is a single flat JSON document per URL — no extra tool-specific
    wrapper format to learn, but also no built-in "give me just the four
    category scores and three metrics" shortcut; a small amount of
    JSON-path extraction is needed regardless of which of the three tools
    is used, since (a) and (b) both bottom out in this same LHR shape for
    the metric values.
- **Multiple URLs in one invocation**: no — confirmed one URL per CLI
  invocation from the README's usage examples; the README's "Related
  Projects" section points to third-party tools like `lighthouse-batch` for
  running Lighthouse across multiple sites, implying no native batch mode
  ([readme.md](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md)).
- **Maintenance**: latest release `v13.4.1`, published 2026-07-20 (per
  GitHub's own Releases API,
  `https://api.github.com/repos/GoogleChrome/lighthouse/releases`) — roughly
  3 weeks old at time of writing, i.e. the most actively released of the
  three options (releases roughly monthly through 2025-2026).

### Summary table

| | `treosh/lighthouse-ci-action` | `@lhci/cli` | plain `lighthouse` CLI |
|---|---|---|---|
| Setup complexity | Low (drop-in action, `urls:` input) | Moderate (manual install + config file + subcommands) | Lowest (single CLI call) |
| Live external URL, no extra config | Yes | Yes (`url` array) | Yes |
| Category scores directly usable | Yes, via `manifest` output, but 0–1 not 0–100 | No dedicated shortcut; same raw LHR as (c) | Raw LHR `categories.<id>.score`, 0–1 |
| LCP/CLS/TBT directly usable | No — requires parsing raw per-URL JSON report | No dedicated shortcut; same raw LHR as (c) | Raw LHR `audits[id].numericValue`, requires JSON-path extraction |
| Multiple URLs, one job | Yes, native `urls:` list | Yes, via `url` array in config | No, one process per URL |
| Latest release (per GitHub Releases API) | `12.6.2`, 2026-03-12 | `v0.15.1`, 2025-06-26 | `v13.4.1`, 2026-07-20 |

---

## 2. Avoiding an infinite trigger loop

GitHub's own documentation on triggering a workflow from a workflow states
plainly:

> "When you use the repository's `GITHUB_TOKEN` to perform tasks, events
> triggered by the `GITHUB_TOKEN`, with the exception of `workflow_dispatch`
> and `repository_dispatch`, will not create a new workflow run. This
> prevents you from accidentally creating recursive workflow runs."

([Triggering a workflow — GitHub Docs](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow))

This is stated generically about *events triggered by the GITHUB_TOKEN* —
it is not scoped to any particular marketplace action for committing. The
restriction is a property of the **token's identity**, not the tool used to
push, so it applies equally whether the commit/push is made by a dedicated
marketplace "auto-commit" action or by a plain `actions/checkout` +
hand-written `git commit && git push` step authenticated with the default
`GITHUB_TOKEN`. GitHub's docs give one documented exception beyond
`workflow_dispatch`/`repository_dispatch`: a `pull_request` opened/updated
by a `GITHUB_TOKEN`-authored action does trigger an *approval-required*
`pull_request` event — not relevant to a plain push to `master`.

**Caveat / how this differs with a PAT**: the same GitHub doc explicitly
notes the escape hatch:

> "If you do want to trigger a workflow from within a workflow run, you can
> use a GitHub App installation access token or a personal access token
> instead of `GITHUB_TOKEN` to trigger events that require a token."

([Triggering a workflow — GitHub Docs](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow))

So: a commit/push authenticated with the default `GITHUB_TOKEN` (via
`actions/checkout` + manual `git push`, or any other tool) will **not**
re-trigger `.github/workflows/deploy.yml`'s `push: branches: [master]`
trigger — no infinite loop. If a **PAT** (or GitHub App token) were used
instead to authenticate the push, that push *would* be treated as coming
from a normal user/app and *would* re-trigger `push`-triggered workflows,
which is the scenario to avoid here if a PAT is ever substituted in.

---

## 3. Chaining a step to run after the existing deploy workflow finishes

Two documented patterns exist:

**(a) `workflow_run` trigger (separate workflow file)**

```yaml
on:
  workflow_run:
    workflows: [Run Tests]
    types:
      - completed
```

- Runs a *separate* workflow file when a named workflow (matched by its
  `name:`) completes (`completed`, or `requested`/`in_progress`).
- Documented constraints from GitHub's own docs
  ([Events that trigger workflows — GitHub Docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)):
  - "This event will only trigger a workflow run if the workflow file
    exists on the default branch" — i.e. the triggering workflow
    (`deploy.yml`) must be on `master`, which it already is here.
  - `workflow_run`-triggered workflows can access secrets and a
    write-scoped token even if the *triggering* workflow was
    lower-privileged — not a concern here since `deploy.yml` already has
    write-ish permissions (`pages: write`, `id-token: write`).
  - GitHub Actions itself avoids infinite recursion here too: `workflow_run`
    does not fire for workflows created by GitHub Actions in a way that
    would let two `workflow_run`-triggered workflows loop each other
    indefinitely; there is also a documented hard limit — "You can't use
    `workflow_run` to chain together more than three levels of workflows."
  - Access to the artifact/commit from the *triggering* run requires
    reading `github.event.workflow_run` context (e.g. its head SHA) rather
    than simply inheriting the same checkout.

**(b) A new job in the *same* workflow file with `needs:`**

- Since `deploy.yml` is a single workflow file already containing `build`
  and `deploy` jobs chained with `needs: build`, a third job (e.g.
  `lighthouse`) could instead be added to that same file with
  `needs: deploy`, running in the same triggering event (`push: branches:
  [master]`) without a second workflow file or the `workflow_run` indirection.
- This avoids the `workflow_run` event's default-branch propagation lag
  (a `workflow_run`-triggered workflow only picks up once the prior run on
  the default branch has *fully completed and been indexed*, which is an
  extra event hop) and avoids needing to read `github.event.workflow_run`
  context to know what was deployed — the job runs in the same workflow run
  and has direct access to the same `deploy` job's outputs (e.g.
  `steps.deployment.outputs.page_url`).

**Tradeoffs (facts only, no recommendation)**:
- `workflow_run` cleanly decouples "audit the live site" from "deploy the
  site" as an independent workflow file, which is useful if the audit
  should also be re-runnable on demand (`workflow_dispatch`) without
  touching the deploy workflow, or should not block/slow the deploy
  workflow's own reported completion status.
- A same-file `needs:`-chained job is simpler (no second workflow file, no
  `workflow_run` payload/context parsing, no default-branch propagation
  hop) but couples the audit job's success/failure and duration directly
  into the deploy workflow's run.
- Both patterns are standard, GitHub-documented ways to run something after
  a Pages "GitHub Actions"-source deploy; GitHub's Pages docs do not
  prescribe either over the other for post-deploy auditing specifically.

---

## 4. Deploy-to-live propagation lag

- The `actions/deploy-pages` action's own README
  ([actions/deploy-pages](https://github.com/actions/deploy-pages)) documents
  a `page_url` output ("The URL of the deployed Pages site") and a
  `timeout` input, but **does not document any propagation delay** between
  the action reporting success and the live URL actually serving the new
  content.
- GitHub's own Pages documentation pages checked
  ([About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages),
  [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site))
  **do not state a specific propagation delay figure** for "GitHub Actions"
  source Pages sites either.
- This does **not** mean there is no lag — only that it is not documented
  as an official, citable number in either primary source checked. Community
  reports (GitHub Community Discussions, not an official/primary source —
  e.g. [Discussion #200884](https://github.com/orgs/community/discussions/200884))
  describe GitHub Pages being served through a CDN layer and anecdotally
  report delays in the range of minutes up to ~30 minutes in edge cases
  where a deployment reports success but the edge cache hasn't caught up,
  but no GitHub-authored source was found confirming a specific number.
- **No documented workaround** (polling, retry-with-backoff, cache-busting
  query param, checking a version marker in the response body) is mentioned
  in either `actions/deploy-pages`'s README or GitHub's Pages docs — any such
  approach would be a project-level design choice, not something sourced
  from GitHub's own documentation.

---

## 5. Multi-page results in one job run

- **`treosh/lighthouse-ci-action`**: natively supports multiple URLs in a
  single job/step via the newline-separated `urls` input; the action loops
  over each URL internally and returns one entry per URL in its `manifest`
  output (see the four-item example shape under 1a) — no per-URL job/step
  duplication needed
  ([README](https://github.com/treosh/lighthouse-ci-action)).
- **Plain `lighthouse` CLI**: no native multi-URL support in a single
  invocation — confirmed from the README's usage examples, which are all
  single-URL (`lighthouse <url>`), and its own "Related Projects" section
  pointing to third-party batch tools instead
  ([readme.md](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md)).
  Auditing four URLs with the plain CLI would mean either four separate CLI
  invocations (in one step via a shell loop, or in four separate
  steps/jobs) with four separate JSON outputs to merge afterward.
- **`@lhci/cli`**: the `collect.url` config option accepts an array of
  URLs, so `lhci collect` also audits multiple URLs in one command/job run,
  writing one LHR JSON file per URL into `.lighthouseci/`
  ([getting-started.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)).

---

## Open questions this doesn't resolve

- No GitHub-authored primary source gives a concrete, citable propagation-
  delay number (minutes) between `actions/deploy-pages` reporting success
  and the production URL serving the new build; only anecdotal community
  reports were found (see §4).
- Whether `workflow_run`'s "workflow file must exist on the default branch"
  requirement introduces a practical first-run bootstrapping issue (the
  audit workflow file itself must already be merged to `master` before it
  can react to a `deploy.yml` run) wasn't tested end-to-end against this
  repo — it's stated in GitHub's docs but not verified against this repo's
  actual Pages/Actions settings.
- Exact JSON key stability/versioning guarantees for the Lighthouse Result
  (LHR) schema across Lighthouse major versions (e.g. whether
  `audits['largest-contentful-paint']` has ever been renamed) were not
  independently verified beyond the current `main` branch docs cited above.
- No investigation was done into GitHub Actions minute/billing cost or
  Chrome-launch reliability differences between the three tool options
  (out of scope per the prompt).
