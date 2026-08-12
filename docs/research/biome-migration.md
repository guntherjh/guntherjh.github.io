# Research: Migrating from ESLint + Prettier to Biome

Date: 2026-08-11

Scope: what this repo (guntherjh.github.io — a small Eleventy static site) would
concretely gain or lose by replacing its current ESLint 10 (flat config,
`eslint:recommended` only) + Prettier 3 (`tabWidth: 4`) setup with
[Biome](https://biomejs.dev/). No recommendation is made here — facts only.

This repo's current setup, for reference (see `eslint.config.js`,
`.prettierrc.json`, `package.json`, `.github/workflows/checks.yml`):
- ESLint 10.x, flat config, `@eslint/js`'s `eslint:recommended` only, no
  plugins, no TypeScript, scoped to `.js` files, split into a Node-context
  glob (`eleventy.config.js`, `src/_data/**/*.js`) and a browser-context glob
  (`src/js/**/*.js`, `sourceType: "script"`, with `document`, `localStorage`,
  `matchMedia` declared as globals).
- `eslint-config-prettier` disables ESLint's stylistic rules.
- Prettier 3.x, default settings + `tabWidth: 4`, formats JS/CSS/JSON, does
  **not** touch `.njk` templates.
- Both `npm run lint` and `npm run format:check` are required GitHub Actions
  checks (`.github/workflows/checks.yml`), alongside a build check.
- Node 20, npm, ESM (`"type": "module"`).

---

## 1. Feature parity for this exact setup (linting)

**Rule counts (primary source, not third-party summaries):** the actual
`@eslint/js@10.0.1` package that ships `eslint:recommended` was downloaded and
inspected directly (`node_modules/@eslint/js/src/configs/eslint-recommended.js`).
It contains **exactly 64 rules**, all set to `"error"`. Biome's own linter
rules page states Biome has **519 total lint rules** across all supported
languages, organized into 8 groups: Accessibility, Complexity, Correctness,
Nursery, Performance, Security, Style, Suspicious
([biomejs.dev/linter/](https://biomejs.dev/linter/)). Each Biome rule page
states individually whether it's part of the default "recommended" set (e.g.
[noUnusedImports](https://biomejs.dev/linter/rules/no-unused-imports/) is
marked "This rule is recommended, meaning it is enabled by default").

**Rule-by-rule mapping:** Biome publishes an explicit ESLint→Biome rule
mapping at [biomejs.dev/linter/rules-sources/](https://biomejs.dev/linter/rules-sources/).
Cross-checking all 64 `eslint:recommended` rules against that table, the large
majority have a direct or "inspired" Biome equivalent (e.g. `no-debugger` →
`noDebugger`, `no-var` → `noVar`, `no-unused-vars` → `noUnusedVariables`,
`constructor-super` → `noInvalidConstructorSuper`, `eqeqeq` → `noDoubleEquals`).
As of this check, the rule-sources page listed the following `eslint:recommended`
rules with **no supported Biome equivalent**:
- `no-constant-binary-expression`
- `no-delete-var`
- `no-invalid-regexp`
- `no-octal`
- `no-unassigned-vars`
- `no-unexpected-multiline`
- `no-useless-assignment`
- `no-useless-backreference`
- `preserve-caught-error` (a newly-added ESLint 9/10 recommended rule)

That's roughly 8-9 of 64 `eslint:recommended` rules (~13%) without a direct
Biome rule as of the rules-sources page content fetched for this research.
Some of these (e.g. `no-invalid-regexp`, `no-unexpected-multiline`) cover
edge cases a Rust-based parser may partially subsume structurally rather than
via an explicit lint rule, but that isn't confirmed by Biome's docs. Given
this repo's JS is small, hand-written, and has no history of tripping these
specific rules, the practical risk is low — but it is not 100% rule-for-rule
parity.

**Config split (Node vs. browser globals):** Biome supports this repo's
per-glob split via the `overrides` array in `biome.json`
([biomejs.dev/reference/configuration/](https://biomejs.dev/reference/configuration/)).
Each override entry has an `includes` glob array and can set its own
`javascript.globals`, `linter.rules`, and `formatter` options, e.g.:

```json
{
  "overrides": [
    {
      "includes": ["src/js/**/*.js"],
      "javascript": { "globals": ["document", "localStorage", "matchMedia"] }
    }
  ]
}
```

This can express the same two-bucket split this repo's `eslint.config.js`
uses today. One caveat: **Biome has no built-in environment presets** like
ESLint's `env: browser` / `env: node` — confirmed via the configuration
reference — so `document`/`localStorage`/`matchMedia` would still need to be
listed by hand, same as the current ESLint config does. There is no built-in
"module vs script" `sourceType` concept documented the same way ESLint has
it, since Biome's parser handles ES module syntax more uniformly; this
repo's `sourceType: "script"` reasoning for browser files would need to be
re-verified against Biome's parser behavior specifically, which this
research did not confirm line-by-line.

---

## 2. Formatting

**CSS and JSON:** Yes. Biome's formatter supports "JavaScript, TypeScript,
JSX, TSX, JSON, HTML, CSS and GraphQL"
([biomejs.dev/](https://biomejs.dev/) homepage feature summary). So it would
cover this repo's JS, CSS, and JSON formatting needs (`eleventy.config.js`,
`package.json`, `src/_data/**/*.js`, `src/js/**/*.js`, `src/css/**/*.css`,
`src/**/*.json`) in one tool.

**Matching `tabWidth: 4` / byte-for-byte output:** Biome's formatter supports
an `indentWidth` option (default `2`), directly analogous to Prettier's
`tabWidth`, settable to `4` to match this repo's current setting
([biomejs.dev formatter options, fetched from biomejs.dev/formatter/](https://biomejs.dev/formatter/)).
Biome's default `indentStyle` is `tab`, not `space` — Prettier's default is
also `tab: false` (spaces), and this repo doesn't override
`indentStyle`/`useTabs`, so that would need to be checked/set explicitly to
avoid an indentation-character mismatch (Prettier default is spaces; Biome
default is tabs).

Biome publishes a dedicated page of intentional, documented output
differences from Prettier —
[biomejs.dev/formatter/differences-with-prettier/](https://biomejs.dev/formatter/differences-with-prettier/).
Documented differences include:
- Biome unquotes any valid ES2015+ identifier as an object key; Prettier only
  unquotes ES5-valid identifiers.
- Biome omits parentheses around assignments in computed member/class keys
  (`[x = 0]`) where Prettier adds them in one of the two cases.
- Minor differences in trailing-comma placement for arrow function type
  parameters with defaults.
- Differing parenthesis normalization for optional-chain non-null assertions
  (TS-only, not applicable to this repo's plain JS).
- Biome's parser is stricter and will refuse to format certain syntax
  Prettier tolerates (e.g. some invalid/edge-case syntax constructs) — not
  expected to matter for this repo's clean, working JS.

None of the documented differences are semantically significant for typical
plain JS/CSS/JSON files; independent commentary (third-party, not Biome's own
claim) puts Biome/Prettier output compatibility at roughly "97%" for a given
codebase (Manuel's TypeScript tooling comparison,
[sph.sh — "TypeScript Linting and Formatting Tools Compared"](https://sph.sh/en/posts/compare-typescript-formatting-linting-tools/),
retrieved via search — treat this figure as an independent estimate, not a
Biome-published number). In practice, migrating would still produce a
**one-time full-repo reformat diff** the first time `biome format --write`
runs, the same way any formatter swap would, even if the visual difference
per file is usually small (mostly indentation-character defaults and object
key quoting edge cases, per the above).

**Nunjucks (`.njk`) files:** Nunjucks/Jinja templating is **not listed** as a
supported language anywhere in Biome's own language-support matrix
([biomejs.dev/internals/language-support/](https://biomejs.dev/internals/language-support/),
which explicitly enumerates JS/TS, JSON, CSS, HTML — HTML formatting is
still "experimental" as of the version checked — and experimental/opt-in
support for Vue, Svelte, and Astro). Nunjucks has no mention and no roadmap
item found. Because Biome only processes files matching its known
extensions/`files.includes` patterns, `.njk` files would most likely simply
be ignored by default (Biome wouldn't recognize the extension), similar to
today's situation where Prettier's `format`/`format:check` scripts simply
don't list `.njk` in their glob. No explicit "ignore" entry should be
strictly required, but this wasn't tested end-to-end against this repo's
actual `.njk` files — worth verifying in a real trial run before relying on
it.

---

## 3. Performance

**Biome's own claim:** the [biomejs.dev](https://biomejs.dev/) homepage
states the formatter is "~35x Faster than Prettier when formatting 171,127
lines of code in 2,104 files with an Intel Core i7 1270P" — Biome's own
benchmark, methodology not independently reproduced here.

**Independent/third-party context:** A third-party comparison blog post
reports, for a ~10k-line monorepo: ESLint (no type-aware) ~3-5s, Prettier
~2-3s, Biome ~200ms (roughly 15-25x faster than ESLint in that test)
([sph.sh — TypeScript Linting and Formatting Tools Compared](https://sph.sh/en/posts/compare-typescript-formatting-linting-tools/)).
Other secondary/marketing-adjacent sources (Medium/dev.to posts, not
independently verified here) cite similar order-of-magnitude speedups (10x
to 100x depending on codebase size and whether type-aware linting is
involved). These are not primary sources and should be read as directional,
not authoritative.

**Relevance to this repo:** this repo has a handful of JS files
(`eleventy.config.js`, a small number of files under `src/_data/` and
`src/js/`). ESLint + Prettier already run in well under a few seconds in
this repo's CI today. Any Biome speedup would be real but operationally
invisible at this repo's current scale — CI wall-clock time for `lint` +
`format:check` is dominated by `npm ci` and Action runner startup, not
tool execution time, at this file count.

---

## 4. Migration mechanics

Biome ships two dedicated commands to bootstrap a `biome.json` from existing
config, documented at
[biomejs.dev/guides/migrate-eslint-prettier/](https://biomejs.dev/guides/migrate-eslint-prettier/):

- `biome migrate eslint --write` — reads `eslint.config.js` (flat config) or
  legacy `.eslintrc*`, including `extends` and plugin rule references, and
  writes equivalent settings into `biome.json`. Rule names are converted
  kebab-case → camelCase. Does **not** support YAML ESLint configs. Rules
  that are "inspired" by (not identical to) an ESLint rule are only migrated
  if you pass `--include-inspired`.
- `biome migrate prettier --write` — reads `.prettierrc.json` (also
  `.prettierrc.js`) and translates formatting options (indentation, quote
  style, etc.) into `biome.json`. Does not support JSON5/TOML Prettier
  config formats (not relevant here — this repo's `.prettierrc.json` is
  plain JSON).
- Biome's own docs caveat: "you are unlikely to get exactly the same
  behavior as ESLint because Biome has chosen not to implement some rule
  options."

**Realistic step list for this specific repo:**
1. `npm install --save-dev --save-exact @biomejs/biome` (or `npx @biomejs/biome init`).
2. Run `biome migrate eslint --write` against `eslint.config.js` to seed
   `biome.json`'s linter section, then run `biome migrate prettier --write`
   against `.prettierrc.json` to seed the formatter section
   (`indentWidth: 4`).
3. Manually add an `overrides` entry for `src/js/**/*.js` with
   `javascript.globals: ["document", "localStorage", "matchMedia"]`, since
   the migration tool's ability to carry over this repo's custom
   Node-vs-browser glob split/globals split is not documented as automatic —
   this repo's globals are declared in a `languageOptions.globals` block the
   migrator may or may not translate correctly; this needs manual
   verification either way.
4. Decide on `indentStyle` (Biome defaults to `tab`; this repo currently
   gets spaces from Prettier's default) and set explicitly if spaces are
   wanted.
5. Ensure `.njk` files remain untouched — verify via a `files.includes` check
   or a dry run, since (per §2) they're not a Biome-recognized extension.
6. Remove `eslint`, `@eslint/js`, `eslint-config-prettier`, `prettier` from
   `package.json` devDependencies; remove `eslint.config.js` and
   `.prettierrc.json`.
7. Update `package.json` scripts: today's `lint`, `format`, `format:check`
   would collapse to something like `"lint": "biome lint ."`,
   `"format": "biome format --write ."`, `"check": "biome check ."` (Biome's
   `check` command runs formatting + linting + import-organizing together in
   one pass, and `biome ci` is a dedicated CI-oriented variant of `check`
   per [biomejs.dev getting-started guide](https://biomejs.dev/guides/getting-started/)).
8. Update `.github/workflows/checks.yml`: the current `lint` and
   `format-check` jobs could either stay as two jobs calling the new Biome
   scripts, or be collapsed into a single `biome ci` job — a workflow
   decision, not a technical requirement.
9. One-time full-repo run of `biome format --write .` to normalize existing
   files (expect a diff, see §2), reviewed and committed once.

This is a small, mechanical migration for a repo this size (few JS files, no
custom ESLint rules/plugins to reconcile) — the main manual-verification
items are the Node/browser globals override and confirming `.njk` files are
left alone, both call outs above.

---

## 5. Maturity/stability signals

- **Current version (verified directly against the npm registry, a primary
  source, at research time):** `@biomejs/biome@2.5.8`, matching the latest
  tag on [github.com/biomejs/biome/releases](https://github.com/biomejs/biome/releases).
- **1.0 stable release:** Biome reached 1.0 on **August 29, 2023**
  ([biomejs.dev/blog/biome-v1/](https://biomejs.dev/blog/biome-v1/)) — roughly
  three years of stable-line history by the time of this research.
- **2.0 major version:** Biome 2.0 ("Biotype") shipped in 2025
  ([biomejs.dev/blog/biome-v2/](https://biomejs.dev/blog/biome-v2/)), adding
  type-aware linting, an internal `ProjectLayout` for better monorepo
  handling, and a first iteration of linter plugins. It introduced breaking
  config changes — the `include`/`ignore` fields were merged into one
  `includes` field, and the default "recommended" rule set was reworked to
  be less aggressive by default (both are breaking changes for anyone
  relying on old config shape or the old recommended rule severities). The
  `biome migrate` command is documented to handle the config-shape breaking
  changes automatically; some other changes required a manual migration
  guide.
- **Release cadence:** GitHub releases show Biome ships very frequently —
  patch releases roughly weekly, based on the recent release history at
  [github.com/biomejs/biome/releases](https://github.com/biomejs/biome/releases).
- **Backing:** Biome is a **community fork of the now-discontinued Rome
  Tools** project, not a single-company product; it's maintained by a
  distributed group of core contributors and is sponsored by hosting company
  **Depot**, per Biome's own credits page
  ([biomejs.dev/internals/credits/](https://biomejs.dev/internals/credits/)).
  This is a different governance model than Prettier (community, long-lived,
  effectively a de facto standard) or ESLint (community, OpenJS Foundation
  member project) — worth noting as a different maturity/backing profile,
  not a red flag by itself given ~3 years of stable releases.
- **Editor integration:** an official first-party VS Code extension exists
  (`biomejs.biome` on the VS Code Marketplace), with **809,265 installs**
  and a 3.5-star rating (44 reviews) at the time of this research
  ([marketplace.visualstudio.com/items?itemName=biomejs.biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)),
  supporting format-on-save, quick fixes, and refactoring. Biome also
  documents [first-party extensions](https://biomejs.dev/editors/first-party-extensions/)
  for other editors. ESLint's and Prettier's VS Code extensions are older
  and more heavily used, but no direct install-count comparison was pulled
  for this research.

---

## 6. What this repo would lose (or gain) by migrating

**Gains / simplification:**
- `eslint-config-prettier`'s entire reason to exist — preventing ESLint's
  stylistic rules from fighting Prettier's formatting — goes away, because
  in Biome the linter and formatter are the same tool built by the same
  project and are designed not to conflict (this specific framing is
  reflected across multiple secondary sources characterizing Biome's design,
  e.g. [Better Stack's Biome vs ESLint guide](https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/);
  Biome's own docs don't have a single FAQ page directly addressing this
  claim in the pages checked for this research, so treat the specific
  wording as secondary-source characterization, not a direct Biome quote).
- One config file (`biome.json`) instead of two (`eslint.config.js` +
  `.prettierrc.json`), and one devDependency instead of four
  (`eslint`, `@eslint/js`, `eslint-config-prettier`, `prettier` →
  `@biomejs/biome`).
- One CLI/one command (`biome check` / `biome ci`) can replace running two
  separate tools (`eslint .` and `prettier --check ...`) in CI, if desired.

**Losses / friction:**
- Smaller rule/plugin ecosystem than ESLint's. This repo uses no plugins
  today, so this is currently moot, but if this repo ever wanted an ESLint
  rule that only exists via a plugin (e.g. `eslint-plugin-jsdoc`,
  accessibility-specific plugins beyond what Biome's own `a11y` group
  covers, import-order plugins with options Biome doesn't replicate), that
  specific rule might not have a Biome equivalent — Biome's own migration
  docs acknowledge "you are unlikely to get exactly the same behavior as
  ESLint" for migrated rules with options
  ([biomejs.dev/guides/migrate-eslint-prettier/](https://biomejs.dev/guides/migrate-eslint-prettier/)).
- The ~8-9 `eslint:recommended` rules without a documented Biome equivalent
  (§1) — small, edge-case coverage loss.
- No built-in ESLint-style `env` presets (`env: browser`, `env: node`) —
  globals must be listed manually in Biome too, so this is actually parity,
  not a loss, but worth flagging since it was explicitly asked about.
- Biome's VS Code extension has a meaningfully lower rating (3.5 stars) than
  what's typical for ESLint's/Prettier's long-established extensions
  (install-count/rating for those wasn't independently pulled in this
  research for direct comparison).
- Governance/backing is a community fork of a discontinued predecessor
  (Rome), versus ESLint (OpenJS Foundation) and Prettier (long-standing,
  extremely widely adopted) — a different risk profile, not necessarily
  worse, but a different kind of "who maintains this long-term" bet.

---

## Open questions this doesn't resolve

- Whether Biome's migration tool (`biome migrate eslint`) correctly and
  automatically carries over this repo's specific two-glob
  Node-vs-browser-globals split, or whether that has to be hand-written into
  `overrides` after running the migrator — this wasn't tested against the
  actual repo, only inferred from documentation.
- Whether `.njk` files are silently ignored by Biome by default (because the
  extension isn't recognized) or whether they'd need an explicit
  `files.includes` exclusion — the language-support docs strongly imply the
  former but this wasn't verified with an actual `biome check` run against
  this repo's files.
- The exact byte-level diff Biome's formatter would produce against this
  repo's current Prettier-formatted files (CSS in particular) — not run
  in this research; the "97% compatibility" figure cited in §2 is a
  third-party estimate from a different codebase, not this repo's.
- Whether any of the ~8-9 `eslint:recommended` rules without a Biome
  equivalent (§1) would ever actually fire against this repo's real code —
  not tested; the gap is reported based on Biome's rules-sources mapping
  page content only.
- No independent, reproducible (non-marketing) benchmark specific to a
  project this small (a handful of files) was found — all performance
  numbers found (Biome's own and third-party) are from larger
  (10k-171k-line) codebases and may not be representative of the
  millisecond-scale runtime this repo would see either way.
