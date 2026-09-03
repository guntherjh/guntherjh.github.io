import { describe, expect, it } from "vitest";
import {
	metricLevel,
	scoreLevel,
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
