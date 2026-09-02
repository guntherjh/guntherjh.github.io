import { writeFile } from "node:fs/promises";
import { launch } from "chrome-launcher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatWithBiome } from "./lib/format-json.mjs";
import {
	fetchLighthouseData,
	formatLighthouseData,
	initializeAudit,
} from "./lighthouse-audit.mjs";
import lighthouse from "lighthouse";

vi.mock(import("lighthouse"));
vi.mock(import("chrome-launcher"));
vi.mock(import("node:fs/promises"));
vi.mock(import("./lib/format-json.mjs"));

afterEach(() => {
	vi.clearAllMocks();
});

describe("Lighthouse audit", () => {
	describe("fetchLighthouseData", () => {
		it("should throw an error if the promise for fetching lighthouse data rejects", async () => {
			lighthouse.mockRejectedValue("error");
			await expect(
				fetchLighthouseData("8080", "http://example.com"),
			).rejects.toThrow();
		});
		it("should throw an error if the promise resolves, but nothing is returned", async () => {
			lighthouse.mockResolvedValue();
			await expect(
				fetchLighthouseData("8080", "http://example.com"),
			).rejects.toThrow();
		});
		it("should return lighthouse data with valid response", async () => {
			const mockResponse = {
				lhr: { some: "data" },
			};
			lighthouse.mockResolvedValue(mockResponse);
			const response = await fetchLighthouseData("8080", "http://example.com");
			expect(response).toEqual(mockResponse.lhr);
		});
	});

	describe("formatLighthouseData", () => {
		let mockLhrData;
		beforeEach(() => {
			mockLhrData = {
				categories: {
					performance: {
						score: 0.98,
					},
					accessibility: {
						score: 0.99,
					},
					"best-practices": {
						score: 1.0,
					},
					seo: {
						score: 0.92,
					},
				},
				audits: {
					"largest-contentful-paint": {
						numericValue: 1235.5,
					},
					"cumulative-layout-shift": {
						numericValue: 0.001,
					},
					"total-blocking-time": {
						numericValue: 12,
					},
				},
			};
		});
		it("should return scores out of 100 for each Lighthouse category", () => {
			expect(formatLighthouseData(mockLhrData).scores).toEqual({
				performance: 98,
				accessibility: 99,
				"best-practices": 100,
				seo: 92,
			});
		});
		it("should return numerical value for lcp, cls, and tbt metrics", () => {
			expect(formatLighthouseData(mockLhrData).lcp).toEqual(1235.5);
			expect(formatLighthouseData(mockLhrData).cls).toEqual(0.001);
			expect(formatLighthouseData(mockLhrData).tbt).toEqual(12);
		});
	});

	describe("initializeAudit", () => {
		let mockChrome;
		let mockLhrData;

		beforeEach(() => {
			mockChrome = { port: 9222, kill: vi.fn().mockResolvedValue() };
			launch.mockResolvedValue(mockChrome);

			mockLhrData = {
				categories: {
					performance: { score: 0.9 },
					accessibility: { score: 0.9 },
					"best-practices": { score: 0.9 },
					seo: { score: 0.9 },
				},
				audits: {
					"largest-contentful-paint": { numericValue: 1000 },
					"cumulative-layout-shift": { numericValue: 0.01 },
					"total-blocking-time": { numericValue: 50 },
				},
			};
			lighthouse.mockResolvedValue({ lhr: mockLhrData });
		});

		it("audits every configured page and writes one snapshot with all of them", async () => {
			await initializeAudit();

			expect(lighthouse).toHaveBeenCalledTimes(4);
			expect(writeFile).toHaveBeenCalledTimes(1);

			const [outputPath, contents] = writeFile.mock.calls[0];
			expect(outputPath).toMatch(/lighthouse\.json$/);

			const snapshot = JSON.parse(contents);
			expect(Object.keys(snapshot.pages)).toEqual([
				"Home",
				"About",
				"Resume",
				"Blog",
			]);
			expect(snapshot.pages.Home.scores).toEqual({
				performance: 90,
				accessibility: 90,
				"best-practices": 90,
				seo: 90,
			});
		});

		it("formats the written snapshot with Biome", async () => {
			await initializeAudit();

			expect(formatWithBiome).toHaveBeenCalledWith(
				expect.stringMatching(/lighthouse\.json$/),
			);
		});

		it("kills Chrome after a successful run", async () => {
			await initializeAudit();

			expect(mockChrome.kill).toHaveBeenCalledTimes(1);
		});

		it("does not write a snapshot if any page audit fails", async () => {
			lighthouse
				.mockResolvedValueOnce({ lhr: mockLhrData })
				.mockRejectedValueOnce(new Error("audit failed"));

			await expect(initializeAudit()).rejects.toThrow("audit failed");

			expect(writeFile).not.toHaveBeenCalled();
			expect(formatWithBiome).not.toHaveBeenCalled();
		});

		it("still kills Chrome when a page audit fails", async () => {
			lighthouse.mockRejectedValue(new Error("audit failed"));

			await expect(initializeAudit()).rejects.toThrow();

			expect(mockChrome.kill).toHaveBeenCalledTimes(1);
		});
	});
});
