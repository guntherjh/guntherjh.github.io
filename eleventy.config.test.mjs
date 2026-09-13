import { describe, expect, it } from "vitest";
import {
	donutSvg,
	historyValues,
	metricLevel,
	scoreLevel,
	sparklineSvg,
	trend,
	trendDetail,
} from "./eleventy.config.js";

describe("scoreLevel", () => {
	it("returns good for scores 90 and above", () => {
		expect(scoreLevel(90)).toBe("good");
		expect(scoreLevel(100)).toBe("good");
	});

	it("returns average for scores 50 through 89", () => {
		expect(scoreLevel(50)).toBe("average");
		expect(scoreLevel(89)).toBe("average");
	});

	it("returns poor for scores below 50", () => {
		expect(scoreLevel(49)).toBe("poor");
		expect(scoreLevel(0)).toBe("poor");
	});
});

describe("metricLevel", () => {
	it("classifies LCP using Core Web Vitals thresholds (ms)", () => {
		expect(metricLevel(2500, "lcp")).toBe("good");
		expect(metricLevel(2501, "lcp")).toBe("average");
		expect(metricLevel(4000, "lcp")).toBe("average");
		expect(metricLevel(4001, "lcp")).toBe("poor");
	});

	it("classifies CLS using Core Web Vitals thresholds (unitless)", () => {
		expect(metricLevel(0.1, "cls")).toBe("good");
		expect(metricLevel(0.11, "cls")).toBe("average");
		expect(metricLevel(0.25, "cls")).toBe("average");
		expect(metricLevel(0.26, "cls")).toBe("poor");
	});

	it("classifies TBT using Lighthouse's own scoring thresholds (ms)", () => {
		expect(metricLevel(200, "tbt")).toBe("good");
		expect(metricLevel(201, "tbt")).toBe("average");
		expect(metricLevel(600, "tbt")).toBe("average");
		expect(metricLevel(601, "tbt")).toBe("poor");
	});

	it("returns null for an unrecognized metric key", () => {
		expect(metricLevel(10, "unknown")).toBeNull();
	});
});

describe("trend", () => {
	it("returns null when there is no previous level to compare against", () => {
		expect(trend("good", undefined)).toBeNull();
		expect(trend("good", null)).toBeNull();
	});

	it("reports flat when the level is unchanged, regardless of which tier", () => {
		expect(trend("good", "good")).toEqual({
			direction: "flat",
			outcome: "flat",
		});
		expect(trend("poor", "poor")).toEqual({
			direction: "flat",
			outcome: "flat",
		});
	});

	it("reports improved when the level moved to a better tier", () => {
		expect(trend("good", "average")).toEqual({
			direction: "up",
			outcome: "improved",
		});
		expect(trend("average", "poor")).toEqual({
			direction: "up",
			outcome: "improved",
		});
	});

	it("reports regressed when the level moved to a worse tier", () => {
		expect(trend("average", "good")).toEqual({
			direction: "down",
			outcome: "regressed",
		});
		expect(trend("poor", "average")).toEqual({
			direction: "down",
			outcome: "regressed",
		});
	});
});

describe("trendDetail", () => {
	it("describes an improvement, framed by tier, self-contained", () => {
		expect(
			trendDetail({
				label: "Accessibility",
				currentDisplay: "95",
				currentLevel: "good",
				previousDisplay: "78",
				previousLevel: "average",
				previousDate: "September 4, 2026",
			}),
		).toBe(
			"Accessibility 95 (good). Previous audit September 4, 2026: 78 " +
				"(needs improvement). Tier improved.",
		);
	});

	it("describes a regression and keeps each metric's own display units", () => {
		expect(
			trendDetail({
				label: "LCP",
				currentDisplay: "4.3s",
				currentLevel: "poor",
				previousDisplay: "1.9s",
				previousLevel: "good",
				previousDate: "September 4, 2026",
			}),
		).toBe(
			"LCP 4.3s (poor). Previous audit September 4, 2026: 1.9s (good). " +
				"Tier regressed.",
		);
	});

	it("returns an empty string when the tier did not change", () => {
		expect(
			trendDetail({
				label: "Performance",
				currentDisplay: "88",
				currentLevel: "good",
				previousDisplay: "100",
				previousLevel: "good",
				previousDate: "September 4, 2026",
			}),
		).toBe("");
	});

	it("returns an empty string when there is no previous audit", () => {
		expect(
			trendDetail({
				label: "SEO",
				currentDisplay: "100",
				currentLevel: "good",
				previousDisplay: undefined,
				previousLevel: null,
				previousDate: undefined,
			}),
		).toBe("");
	});
});

describe("donutSvg", () => {
	it("draws a track ring and a value arc, decorative to assistive tech", () => {
		const svg = donutSvg(75, "good");
		expect(svg).toContain('aria-hidden="true"');
		expect(svg).toContain("lh-donut-track");
		expect(svg).toContain("lh-donut-arc");
		expect((svg.match(/<circle/g) || []).length).toBe(2);
	});

	it("encodes the score as the filled fraction of a pathLength-100 ring", () => {
		expect(donutSvg(75, "good")).toContain('stroke-dasharray="75 25"');
		expect(donutSvg(0.4 + 0.1, "good")).toContain(
			'stroke-dasharray="0.5 99.5"',
		);
	});

	it("tags the arc with the tier so the DOM is self-describing", () => {
		expect(donutSvg(40, "poor")).toContain("lh-donut-arc lh-poor");
		expect(donutSvg(95, "good")).toContain("lh-donut-arc lh-good");
	});

	it("fills the whole ring at 100 and omits the arc entirely at 0", () => {
		expect(donutSvg(100, "good")).toContain('stroke-dasharray="100 0"');
		const zero = donutSvg(0, "poor");
		expect(zero).not.toContain("lh-donut-arc");
		expect((zero.match(/<circle/g) || []).length).toBe(1);
	});

	it("clamps scores outside 0–100", () => {
		expect(donutSvg(140, "good")).toContain('stroke-dasharray="100 0"');
		expect(donutSvg(-20, "poor")).not.toContain("lh-donut-arc");
	});
});

describe("sparklineSvg", () => {
	const yValues = (svg) =>
		[...svg.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]));

	it("returns nothing when there is fewer than one segment to draw", () => {
		expect(sparklineSvg([], "tbt")).toBe("");
		expect(sparklineSvg([90], "tbt")).toBe("");
	});

	it("returns nothing for a metric with no fixed domain, including every category score", () => {
		expect(sparklineSvg([90, 100, 95], "accessibility")).toBe("");
		// Performance keeps its Score Donut but deliberately has no
		// sparkline — the donut already carries the current value
		// (guntherjh/guntherjh.github.io#158).
		expect(sparklineSvg([90, 100, 95], "performance")).toBe("");
	});

	it("plots one point per run, oldest to newest, decorative", () => {
		const svg = sparklineSvg([90, 100, 85, 88], "tbt");
		expect(svg).toContain('aria-hidden="true"');
		expect((svg.match(/[ML][\d.]+ [\d.]+/g) || []).length).toBe(4);
		expect(svg).toMatch(/^<svg[^>]*>\s*<path/);
	});

	it("marks the newest point with a dot", () => {
		const svg = sparklineSvg([90, 100], "tbt");
		expect(svg).toContain("<circle");
	});

	it("scales against the fixed per-metric domain, not the data range", () => {
		// TBT 0ms and 11ms are both "good" and sit close together near the
		// bottom of the plotted band (low TBT is good) — not spread across
		// the full height the way an auto-fit scale (min 0, max 11) would
		// place them, which would make a real near-zero value and a tiny
		// regression look like a dramatic swing.
		const ys = yValues(sparklineSvg([0, 11], "tbt"));
		expect(Math.min(...ys)).toBeGreaterThan(8);
		expect(ys[0]).not.toEqual(ys[1]);
	});

	it("clamps points outside the domain to the edges of the box", () => {
		const ys = yValues(sparklineSvg([-500, 50, 9000], "lcp"));
		for (const y of ys) {
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(12);
		}
		// first point below the domain -> bottom edge; last above -> top edge
		expect(ys[0]).toBeGreaterThan(ys[1]);
		expect(ys[2]).toBeLessThan(ys[1]);
	});

	it("draws a flat line when every run has the same value (e.g. CLS 0)", () => {
		const ys = yValues(sparklineSvg([0, 0, 0, 0], "cls"));
		expect(new Set(ys).size).toBe(1);
	});
});

describe("historyValues", () => {
	const history = [
		{ pages: { Home: { scores: { performance: 88 }, lcp: 1200 } } },
		{ pages: { Home: { scores: { performance: 100 }, lcp: 900 } } },
		{ pages: { Home: { scores: { performance: 95 }, lcp: 1000 } } },
	];

	it("returns a page+metric's values oldest run first", () => {
		expect(historyValues(history, "Home", "performance")).toEqual([
			95, 100, 88,
		]);
	});

	it("reads Core Web Vitals from the run's top level, scores from .scores", () => {
		expect(historyValues(history, "Home", "lcp")).toEqual([1000, 900, 1200]);
	});

	it("skips runs missing that page or a numeric value for it", () => {
		const patchy = [
			{ pages: { Home: { scores: { performance: 90 } } } },
			{ pages: { About: { scores: { performance: 80 } } } },
			{ pages: { Home: { scores: {} } } },
		];
		expect(historyValues(patchy, "Home", "performance")).toEqual([90]);
	});

	it("returns an empty array when there is no history", () => {
		expect(historyValues(undefined, "Home", "performance")).toEqual([]);
	});
});
