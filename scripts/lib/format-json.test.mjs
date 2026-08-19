import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatWithBiome } from "./format-json.mjs";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

afterEach(() => {
	vi.clearAllMocks();
});

describe("formatWithBiome", () => {
	it("runs biome format --write against the given path", () => {
		formatWithBiome("src/_data/lighthouse.json");

		expect(execFileSync).toHaveBeenCalledWith("biome", [
			"format",
			"--write",
			"src/_data/lighthouse.json",
		]);
	});
});
