import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

const jsFiles = ["eleventy.config.js", "src/_data/**/*.js", "src/js/**/*.js"];

export default [
  {
    ignores: ["_site/**", "node_modules/**"],
  },

  // eslint:recommended, explicitly scoped to jsFiles so a stray .js file
  // elsewhere in the repo doesn't get linted with no globals defined.
  {
    files: jsFiles,
    ...js.configs.recommended,
  },

  // Node-context files: run under Node during the Eleventy build.
  {
    files: ["eleventy.config.js", "src/_data/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },

  // Browser-context files: run in visitors' browsers, plain <script> tags
  // (not modules — see src/about.njk's <script src="..."> usage).
  {
    files: ["src/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        document: "readonly",
        localStorage: "readonly",
      },
    },
  },

  // Must be last: disables any ESLint stylistic rules that could conflict
  // with Prettier, which owns formatting.
  eslintConfigPrettier,
];
