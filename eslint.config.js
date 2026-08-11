import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,

  {
    ignores: ["_site/**", "node_modules/**"],
  },

  // Node-context files: run under Node during the Eleventy build.
  {
    files: ["eleventy.config.js", "src/_data/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
      },
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
        window: "readonly",
        localStorage: "readonly",
        console: "readonly",
      },
    },
  },

  // Must be last: disables any ESLint stylistic rules that could conflict
  // with Prettier, which owns formatting.
  eslintConfigPrettier,
];
