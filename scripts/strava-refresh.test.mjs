import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatWithBiome } from "./lib/format-json.mjs";

vi.mock(import("node:child_process"));
vi.mock(import("node:fs/promises"));
vi.mock(import("./lib/format-json.mjs"));

// CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN are read from process.env once, at
// module load time (see strava-refresh.mjs) — they have to be set before
// the module is first imported, so this can't use a static top-level
// import like the other test files here do.
process.env.STRAVA_CLIENT_ID = "test-client-id";
process.env.STRAVA_CLIENT_SECRET = "test-client-secret";
process.env.STRAVA_REFRESH_TOKEN = "test-refresh-token";

const {
	fetchJson,
	refreshAccessToken,
	updateRefreshTokenSecret,
	buildActivities,
	buildStats,
	refreshStravaData,
} = await import("./strava-refresh.mjs");

function jsonResponse(body, ok = true, status = 200) {
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
	};
}

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	delete process.env.GITHUB_ACTIONS;
});

describe("Strava refresh", () => {
	describe("fetchJson", () => {
		it("sends a Bearer token when given an access token", async () => {
			const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
			vi.stubGlobal("fetch", fetchMock);

			await fetchJson("https://example.com", "abc123");

			expect(fetchMock).toHaveBeenCalledWith("https://example.com", {
				headers: { Authorization: "Bearer abc123" },
			});
		});

		it("sends no Authorization header when no access token is given", async () => {
			const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
			vi.stubGlobal("fetch", fetchMock);

			await fetchJson("https://example.com", undefined);

			expect(fetchMock).toHaveBeenCalledWith("https://example.com", {
				headers: {},
			});
		});

		it("returns the parsed JSON body on success", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue(jsonResponse({ some: "data" })),
			);

			const result = await fetchJson("https://example.com", "abc123");

			expect(result).toEqual({ some: "data" });
		});

		it("throws with the status and body text when the response is not ok", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 401,
					text: () => Promise.resolve("Unauthorized"),
				}),
			);

			await expect(fetchJson("https://example.com", "abc123")).rejects.toThrow(
				"https://example.com responded 401: Unauthorized",
			);
		});
	});

	describe("refreshAccessToken", () => {
		it("posts to Strava's token endpoint and returns the parsed tokens", async () => {
			const fetchMock = vi.fn().mockResolvedValue(
				jsonResponse({
					access_token: "new-access",
					refresh_token: "new-refresh",
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const tokens = await refreshAccessToken();

			expect(fetchMock).toHaveBeenCalledWith(
				"https://www.strava.com/oauth/token",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
				}),
			);
			expect(tokens).toEqual({
				access_token: "new-access",
				refresh_token: "new-refresh",
			});
		});

		it("throws with the status and body text when the refresh fails", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 400,
					text: () => Promise.resolve("invalid_grant"),
				}),
			);

			await expect(refreshAccessToken()).rejects.toThrow(
				"Strava token refresh failed: 400 invalid_grant",
			);
		});
	});

	describe("updateRefreshTokenSecret", () => {
		it("pipes the new token to `gh secret set` on the strava environment", () => {
			updateRefreshTokenSecret("rotated-token");

			expect(execFileSync).toHaveBeenCalledWith(
				"gh",
				["secret", "set", "STRAVA_REFRESH_TOKEN", "--env", "strava"],
				expect.objectContaining({
					input: "rotated-token",
					stdio: ["pipe", "inherit", "inherit"],
				}),
			);
		});

		it("authenticates gh via GH_PAT_SECRETS_WRITE, not the default token", () => {
			process.env.GH_PAT_SECRETS_WRITE = "pat-value";

			updateRefreshTokenSecret("rotated-token");

			const [, , options] = execFileSync.mock.calls[0];
			expect(options.env.GH_TOKEN).toBe("pat-value");

			delete process.env.GH_PAT_SECRETS_WRITE;
		});

		it("masks the new token in Actions logs when running in GitHub Actions", () => {
			process.env.GITHUB_ACTIONS = "true";
			const logSpy = vi.spyOn(console, "log").mockReturnValue(undefined);

			updateRefreshTokenSecret("rotated-token");

			expect(logSpy).toHaveBeenCalledWith("::add-mask::rotated-token");
		});

		it("does not log a mask command outside of GitHub Actions", () => {
			const logSpy = vi.spyOn(console, "log").mockReturnValue(undefined);

			updateRefreshTokenSecret("rotated-token");

			expect(logSpy).not.toHaveBeenCalled();
		});
	});

	describe("buildActivities", () => {
		it("filters out private activities", () => {
			const activities = buildActivities([
				{ private: true, type: "Run", name: "Secret run" },
				{ private: false, type: "Ride", name: "Public ride" },
			]);

			expect(activities).toEqual([
				expect.objectContaining({ name: "Public ride" }),
			]);
		});

		it("keeps only the first RECENT_ACTIVITY_COUNT public activities", () => {
			const rawActivities = Array.from({ length: 8 }, (_, i) => ({
				private: false,
				type: "Run",
				name: `Run ${i}`,
			}));

			expect(buildActivities(rawActivities)).toHaveLength(5);
		});

		it("maps only the expected fields", () => {
			const activities = buildActivities([
				{
					private: false,
					type: "Run",
					name: "Morning run",
					distance: 5000,
					moving_time: 1800,
					start_date: "2026-01-01T00:00:00Z",
					extra: "should be dropped",
				},
			]);

			expect(activities).toEqual([
				{
					type: "Run",
					name: "Morning run",
					distance: 5000,
					moving_time: 1800,
					start_date: "2026-01-01T00:00:00Z",
				},
			]);
		});
	});

	describe("buildStats", () => {
		it("includes only sports with at least one recent activity", () => {
			const stats = buildStats({
				recent_ride_totals: {
					count: 0,
					distance: 0,
					moving_time: 0,
					elevation_gain: 0,
				},
				recent_run_totals: {
					count: 3,
					distance: 15000,
					moving_time: 5400,
					elevation_gain: 120,
				},
			});

			expect(stats).toEqual({
				Run: {
					count: 3,
					distance: 15000,
					moving_time: 5400,
					elevation_gain: 120,
				},
			});
		});

		it("skips sports missing entirely from the raw stats", () => {
			const stats = buildStats({
				recent_swim_totals: {
					count: 1,
					distance: 1000,
					moving_time: 600,
					elevation_gain: 0,
				},
			});

			expect(Object.keys(stats)).toEqual(["Swim"]);
		});

		it("returns an empty object when nothing has recent activity", () => {
			expect(buildStats({})).toEqual({});
		});
	});

	describe("refreshStravaData", () => {
		function mockSuccessfulFetches({
			refreshToken = "test-refresh-token",
		} = {}) {
			vi.stubGlobal(
				"fetch",
				vi.fn((url) => {
					if (url === "https://www.strava.com/oauth/token") {
						return Promise.resolve(
							jsonResponse({
								access_token: "access-token",
								refresh_token: refreshToken,
							}),
						);
					}
					if (url === "https://www.strava.com/api/v3/athlete") {
						return Promise.resolve(jsonResponse({ id: 42 }));
					}
					if (
						url.startsWith("https://www.strava.com/api/v3/athlete/activities")
					) {
						return Promise.resolve(
							jsonResponse([
								{
									private: false,
									type: "Run",
									name: "Morning run",
									distance: 5000,
									moving_time: 1800,
									start_date: "2026-01-01T00:00:00Z",
								},
							]),
						);
					}
					if (url === "https://www.strava.com/api/v3/athletes/42/stats") {
						return Promise.resolve(
							jsonResponse({
								recent_run_totals: {
									count: 1,
									distance: 5000,
									moving_time: 1800,
									elevation_gain: 10,
								},
							}),
						);
					}
					throw new Error(`Unexpected fetch: ${url}`);
				}),
			);
		}

		it("writes a Snapshot built from the refreshed token, activities, and stats", async () => {
			mockSuccessfulFetches();

			await refreshStravaData();

			expect(writeFile).toHaveBeenCalledTimes(1);
			const [outputPath, contents] = writeFile.mock.calls[0];
			expect(outputPath).toMatch(/strava\.json$/);

			const snapshot = JSON.parse(contents);
			expect(snapshot.activities).toEqual([
				{
					type: "Run",
					name: "Morning run",
					distance: 5000,
					moving_time: 1800,
					start_date: "2026-01-01T00:00:00Z",
				},
			]);
			expect(snapshot.stats).toEqual({
				Run: {
					count: 1,
					distance: 5000,
					moving_time: 1800,
					elevation_gain: 10,
				},
			});
			expect(formatWithBiome).toHaveBeenCalledWith(outputPath);
		});

		it("rotates the refresh token secret when Strava returns a new one", async () => {
			mockSuccessfulFetches({ refreshToken: "rotated-token" });

			await refreshStravaData();

			expect(execFileSync).toHaveBeenCalledWith(
				"gh",
				["secret", "set", "STRAVA_REFRESH_TOKEN", "--env", "strava"],
				expect.objectContaining({ input: "rotated-token" }),
			);
		});

		it("does not touch the secret when Strava returns the same refresh token", async () => {
			mockSuccessfulFetches({ refreshToken: "test-refresh-token" });

			await refreshStravaData();

			expect(execFileSync).not.toHaveBeenCalled();
		});

		it("does not write a Snapshot if any Strava request fails", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 500,
					text: () => Promise.resolve("Strava is down"),
				}),
			);

			await expect(refreshStravaData()).rejects.toThrow();

			expect(writeFile).not.toHaveBeenCalled();
			expect(formatWithBiome).not.toHaveBeenCalled();
		});
	});
});
