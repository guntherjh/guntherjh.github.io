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
import { writeFile } from "node:fs/promises";
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

async function auditPage(port, url) {
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

async function main() {
	const chrome = await launch({
		chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
	});

	try {
		const pages = {};
		for (const page of PAGES) {
			const url = new URL(page.path, BASE_URL).toString();
			console.log(`Auditing ${page.label} (${url})...`);
			pages[page.label] = await auditPage(chrome.port, url);
		}

		const snapshot = { capturedAt: new Date().toISOString(), pages };
		await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
		formatWithBiome(OUTPUT_PATH);
		console.log(`Wrote ${OUTPUT_PATH}`);
	} finally {
		await chrome.kill();
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
