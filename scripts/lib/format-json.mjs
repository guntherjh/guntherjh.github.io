import { execFileSync } from "node:child_process";

// Biome formats JSON with tabs (biome.json); plain JSON.stringify doesn't
// match that, which the required `check` CI job would then reject —
// running Biome's own formatter here guarantees byte-for-byte conformance
// with whatever biome.json's settings currently say, rather than hand-
// replicating them (discovered the hard way: this mismatch silently
// blocked every generated Snapshot's auto-merge PR from ever passing
// checks — see guntherjh/guntherjh.github.io#47). No `npx` prefix needed:
// both callers run via `npm run <script>`, which already puts
// node_modules/.bin (where `biome` lives) on PATH.
export function formatWithBiome(path) {
	execFileSync("biome", ["format", "--write", path]);
}
