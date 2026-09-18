#!/usr/bin/env node
// Refreshes the Strava OAuth token, fetches recent Activities + Stats, and
// writes src/_data/strava.json (the Strava Snapshot — see CONTEXT.md) for
// the About page's Strava Widget to render at the next Eleventy build.
//
// Run daily (see .github/workflows/strava-refresh.yml's schedule trigger)
// against the real Strava API — per the widget's data-contract decision
// (guntherjh/guntherjh.github.io#28).
//
// Deliberately throws/exits non-zero on any failure rather than writing a
// partial Snapshot — a failed run should leave the previous Snapshot in
// place untouched (see CONTEXT.md's Strava Snapshot entry). This only
// affects this job's own pass/fail status; nothing else in the site's
// build depends on this run succeeding.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatWithBiome } from "./lib/format-json.mjs";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;
const RECENT_ACTIVITY_COUNT = 5;
// Strava's authenticated /athlete/activities call returns the athlete's own
// private activities too, not just public ones — those get filtered out
// below (see buildActivities), so more than RECENT_ACTIVITY_COUNT is
// fetched up front as a buffer, otherwise a private activity in the most
// recent 5 would silently leave the Snapshot with fewer than 5 public ones.
const ACTIVITY_FETCH_COUNT = 30;
// The Run Breakdown (see CONTEXT.md) is fetched separately from the flat
// ACTIVITY_FETCH_COUNT list above, by date window rather than count —
// windowing that list instead would let a quiet stretch (injury, off-
// season) silently shrink the "last 5 Activities" the Strava Widget
// promises to fewer than 5, or even zero. Matches the same 4-week window
// Strava's own recent-totals endpoint uses (see buildStats).
const RECENT_WINDOW_DAYS = 28;
// Strava's documented per_page maximum — fetchRecentActivities pages past
// this only if a single window holds more Activities than that.
const ACTIVITY_PAGE_SIZE = 200;
const SPORT_LABELS = { ride: "Ride", run: "Run", swim: "Swim" };
const OUTPUT_PATH = fileURLToPath(
	new URL("../src/_data/strava.json", import.meta.url),
);

export async function fetchJson(url, accessToken) {
	const response = await fetch(url, {
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
	});
	if (!response.ok) {
		throw new Error(
			`${url} responded ${response.status}: ${await response.text()}`,
		);
	}
	return response.json();
}

// Strava rotates the refresh token on every use (see CONTEXT.md's Refresh
// Job entry / guntherjh/guntherjh.github.io#25's findings) — the value
// returned here supersedes REFRESH_TOKEN for every subsequent run, so it
// must be persisted before this run ends (see updateRefreshTokenSecret).
export async function refreshAccessToken() {
	const response = await fetch("https://www.strava.com/oauth/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			refresh_token: REFRESH_TOKEN,
			grant_type: "refresh_token",
		}),
	});
	if (!response.ok) {
		throw new Error(
			`Strava token refresh failed: ${response.status} ${await response.text()}`,
		);
	}
	return response.json();
}

// Persists a rotated refresh token as a GitHub Actions *secret* on the
// `strava` environment — never committed to a file, since this repo is
// public (see guntherjh/guntherjh.github.io#27's resolution). Uses `gh
// secret set` (authenticated via GH_PAT_SECRETS_WRITE, not the default
// GITHUB_TOKEN, which can't manage secrets at all) so GitHub's own CLI
// handles the encryption — this script never implements that itself, and
// the token value is passed via stdin, never a CLI argument or log line.
export function updateRefreshTokenSecret(newRefreshToken) {
	// Registers the new value for GitHub Actions' own log redaction before
	// it could appear anywhere — it hasn't been loaded from `secrets.*` yet
	// at this point, so it isn't auto-masked without this. `::add-mask::` is
	// only meaningful to the Actions log processor — gated behind
	// GITHUB_ACTIONS (set to "true" automatically by Actions runners) so
	// running this script locally/elsewhere never prints the raw token to
	// stdout for a workflow-command syntax nothing there interprets.
	if (process.env.GITHUB_ACTIONS === "true") {
		console.log(`::add-mask::${newRefreshToken}`);
	}
	execFileSync(
		"gh",
		["secret", "set", "STRAVA_REFRESH_TOKEN", "--env", "strava"],
		{
			input: newRefreshToken,
			env: { ...process.env, GH_TOKEN: process.env.GH_PAT_SECRETS_WRITE },
			stdio: ["pipe", "inherit", "inherit"],
		},
	);
}

// Strava's /athlete/activities `after` param is a Unix epoch in seconds.
// Takes `now` as a parameter (rather than reading the clock itself) so this
// stays a pure, independently-testable function.
export function computeAfterEpochSeconds(now) {
	return Math.floor(
		(now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000,
	);
}

// Pages through every Activity newer than afterEpochSeconds. Strava returns
// Activities newest-first, so a page shorter than ACTIVITY_PAGE_SIZE
// reliably means there's nothing older left in the window worth another
// request.
export async function fetchRecentActivities(accessToken, afterEpochSeconds) {
	const activities = [];
	for (let page = 1; ; page++) {
		const pageActivities = await fetchJson(
			`https://www.strava.com/api/v3/athlete/activities?after=${afterEpochSeconds}&per_page=${ACTIVITY_PAGE_SIZE}&page=${page}`,
			accessToken,
		);
		activities.push(...pageActivities);
		if (pageActivities.length < ACTIVITY_PAGE_SIZE) break;
	}
	return activities;
}

export function buildActivities(rawActivities) {
	// Public Activities only — never ones marked private on Strava (see
	// CONTEXT.md's Activity entry / guntherjh/guntherjh.github.io#28). This
	// repo is public, so a private activity in the committed Snapshot would
	// be a real privacy leak, not just a scope mismatch.
	return rawActivities
		.filter((activity) => !activity.private)
		.slice(0, RECENT_ACTIVITY_COUNT)
		.map((activity) => ({
			type: activity.type,
			sport_type: activity.sport_type,
			name: activity.name,
			distance: activity.distance,
			moving_time: activity.moving_time,
			elevation_gain: activity.total_elevation_gain,
			start_date: activity.start_date,
		}));
}

export function buildStats(rawStats) {
	const stats = {};
	for (const [sportKey, label] of Object.entries(SPORT_LABELS)) {
		const totals = rawStats[`recent_${sportKey}_totals`];
		if (totals && totals.count > 0) {
			stats[label] = {
				count: totals.count,
				distance: totals.distance,
				moving_time: totals.moving_time,
				elevation_gain: totals.elevation_gain,
			};
		}
	}
	return stats;
}

// Strava's own recent-totals endpoint (buildStats above) has no notion of
// Trail Run vs. Run — that distinction only exists per-Activity, via
// `sport_type` (see CONTEXT.md's Run Breakdown entry) — so this buckets the
// same windowed Activities fetchRecentActivities returns, rather than
// pulling a pre-aggregated total from Strava.
export function buildRunBreakdown(rawActivities) {
	const totals = {
		"Road Run": { count: 0, distance: 0, moving_time: 0 },
		"Trail Run": { count: 0, distance: 0, moving_time: 0 },
	};
	for (const activity of rawActivities) {
		if (activity.private || activity.type !== "Run") continue;
		const bucket =
			activity.sport_type === "TrailRun"
				? totals["Trail Run"]
				: totals["Road Run"];
		bucket.count += 1;
		bucket.distance += activity.distance;
		bucket.moving_time += activity.moving_time;
	}
	return Object.fromEntries(
		Object.entries(totals).filter(([, bucket]) => bucket.count > 0),
	);
}

export async function refreshStravaData() {
	const tokens = await refreshAccessToken();
	if (tokens.refresh_token && tokens.refresh_token !== REFRESH_TOKEN) {
		updateRefreshTokenSecret(tokens.refresh_token);
	}

	const athlete = await fetchJson(
		"https://www.strava.com/api/v3/athlete",
		tokens.access_token,
	);

	const [latestActivities, windowedActivities, rawStats] = await Promise.all([
		fetchJson(
			`https://www.strava.com/api/v3/athlete/activities?per_page=${ACTIVITY_FETCH_COUNT}`,
			tokens.access_token,
		),
		fetchRecentActivities(
			tokens.access_token,
			computeAfterEpochSeconds(new Date()),
		),
		fetchJson(
			`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`,
			tokens.access_token,
		),
	]);

	const snapshot = {
		capturedAt: new Date().toISOString(),
		activities: buildActivities(latestActivities),
		stats: buildStats(rawStats),
		runBreakdown: buildRunBreakdown(windowedActivities),
	};
	await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
	formatWithBiome(OUTPUT_PATH);
	console.log(`Wrote ${OUTPUT_PATH}`);
}

// Guarded so importing this module (e.g. strava-refresh.test.mjs importing
// fetchJson/refreshAccessToken/etc.) doesn't also trigger a real refresh
// against the live Strava API as a side effect — this only fires when the
// file is executed directly, e.g. `node scripts/strava-refresh.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
	refreshStravaData().catch((err) => {
		console.error(err);
		process.exitCode = 1;
	});
}
