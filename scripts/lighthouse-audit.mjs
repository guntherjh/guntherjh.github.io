#!/usr/bin/env node
// Audits the live production site with Lighthouse and writes the results to
// src/_data/lighthouse.json (the Lighthouse Snapshot — see CONTEXT.md) for
// the About page's Lighthouse Widget to render at the next Eleventy build.
//
// Run post-deploy (see .github/workflows/deploy.yml's `lighthouse` job,
// `needs: deploy`) against the real production URL, not a local build —
// per the widget's destination decision (guntherjh/guntherjh.github.io#41),
// a CI-measured localhost audit wasn't considered representative enough.
//
// One Chrome instance, launched once via chrome-launcher and reused across
// all four page audits (lighthouse's own CLI has no native multi-page
// support, so this drives lighthouse's programmatic API directly instead of
// shelling out to the CLI four times).
//
// Deliberately throws/exits non-zero on any audit failure rather than
// writing a partial result — a failed run should leave the previous
// Snapshot in place untouched (see CONTEXT.md's Lighthouse Snapshot entry),
// not overwrite it with incomplete data. This only affects this job's own
// pass/fail status in the Actions UI; the site itself already deployed
// successfully before this job even started.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { formatWithBiome } from "./lib/format-json.mjs";

const BASE_URL = "https://johnhenrygunther.com";
const PAGES = [
	{ label: "Home", path: "/" },
	{ label: "About", path: "/about/" },
	{ label: "Resume", path: "/resume/" },
	{ label: "Blog", path: "/blog/" },
];
const OUTPUT_PATH = fileURLToPath(
	new URL("../src/_data/lighthouse.json", import.meta.url),
);
// Bounded so the committed Snapshot file doesn't grow forever — see ADR
// 0006 for why 10, and CONTEXT.md's Lighthouse Snapshot entry for the
// resulting shape (guntherjh/guntherjh.github.io#71).
const MAX_HISTORY = 10;

export async function fetchLighthouseData(port, url) {
	const result = await lighthouse(url, {
		port,
		logLevel: "error",
		output: "json",
		onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
	});
	if (!result) {
		throw new Error(`Lighthouse produced no result for ${url}`);
	}
	const { lhr } = result;

	return lhr;
}

export function formatLighthouseData(lhr) {
	const scores = {};
	for (const [id, category] of Object.entries(lhr.categories)) {
		scores[id] = Math.round(category.score * 100);
	}

	return {
		scores,
		lcp: lhr.audits["largest-contentful-paint"].numericValue,
		cls: lhr.audits["cumulative-layout-shift"].numericValue,
		tbt: lhr.audits["total-blocking-time"].numericValue,
	};
}

// Prepends newSnapshot to whatever history existingData already has (newest
// first), capped at maxHistory. existingData is undefined on the very
// first-ever run (see readExistingSnapshot's ENOENT handling below); a
// pre-history-shaped Snapshot (no `history` key — the shape this file used
// before guntherjh/guntherjh.github.io#71) is likewise treated as having no
// history yet, rather than special-cased — this repo's actual committed
// Snapshot was migrated to the new shape directly as part of that change,
// so this fallback only matters for a stale file slipping through.
export function buildSnapshotHistory(
	existingData,
	newSnapshot,
	maxHistory = MAX_HISTORY,
) {
	const previousHistory = existingData?.history ?? [];
	return { history: [newSnapshot, ...previousHistory].slice(0, maxHistory) };
}

// Returns undefined if the Snapshot file doesn't exist yet (the very first
// run ever, or a corrupted checkout) rather than treating that as a
// failure — everything else (bad JSON, permissions) still propagates,
// consistent with this file's fail-rather-than-write-partial-data stance.
async function readExistingSnapshot() {
	try {
		return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return undefined;
		throw err;
	}
}

export async function initializeAudit() {
	// Read before launching Chrome or running any audit — a bad Snapshot
	// file (unreadable for a reason other than not existing yet) should
	// fail cheaply here, not after four real, live Lighthouse audits have
	// already run against production only to be discarded.
	const existingData = await readExistingSnapshot();

	const chrome = await launch({
		chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
	});

	try {
		const pages = {};
		for (const page of PAGES) {
			const url = new URL(page.path, BASE_URL).toString();
			console.log(`Auditing ${page.label} (${url})...`);
			const lhr = await fetchLighthouseData(chrome.port, url);
			pages[page.label] = formatLighthouseData(lhr);
		}

		const newSnapshot = { capturedAt: new Date().toISOString(), pages };
		const data = buildSnapshotHistory(existingData, newSnapshot);
		await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
		formatWithBiome(OUTPUT_PATH);
		console.log(`Wrote ${OUTPUT_PATH}`);
	} finally {
		await chrome.kill();
	}
}

// Guarded so importing this module (e.g. lighthouse-audit.test.mjs importing
// fetchLighthouseData/formatLighthouseData/initializeAudit) doesn't also
// trigger a real audit run as a side effect — this only fires when the file
// is executed directly, e.g. `node scripts/lighthouse-audit.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
	initializeAudit().catch((err) => {
		console.error(err);
		process.exitCode = 1;
	});
}
