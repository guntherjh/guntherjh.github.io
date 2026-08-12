// Theme toggle: binary light/dark, defaults to system prefers-color-scheme
// until the visitor explicitly overrides it, sticky localStorage override
// once set. Initial theme is decided by an inline pre-paint script in
// base.njk (to avoid a flash of the wrong theme) — this file only owns
// the interactive part: the click handler, persisting the override, and
// following system-preference changes while no override is stored.
// Same native localStorage pattern as src/js/about-sections.js.
//
// There are two .theme-toggle buttons in the DOM (desktop header copy,
// mobile hamburger-panel copy — see base.njk/style.css) — both are
// wired here and kept in sync, since clicking either should flip both.
(function () {
	const STORAGE_KEY = "theme";
	const toggles = document.querySelectorAll(".theme-toggle");
	const media = matchMedia("(prefers-color-scheme: dark)");

	function getStored() {
		try {
			return localStorage.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function setStored(value) {
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// localStorage unavailable — toggle still works, just won't persist.
		}
	}

	function apply(theme) {
		document.documentElement.setAttribute("data-theme", theme);
		const isDark = theme === "dark";
		// aria-label stays static ("Dark mode") — aria-checked alone
		// communicates state, per the ARIA switch pattern.
		toggles.forEach((toggle) => {
			toggle.setAttribute("aria-checked", String(isDark));
		});
	}

	// Sync aria state with whatever the pre-paint script already applied.
	apply(document.documentElement.getAttribute("data-theme"));

	toggles.forEach((toggle) => {
		toggle.addEventListener("click", () => {
			const next =
				document.documentElement.getAttribute("data-theme") === "dark"
					? "light"
					: "dark";
			setStored(next);
			apply(next);
		});
	});

	media.addEventListener("change", (e) => {
		if (getStored()) return; // explicit override is sticky, ignore system changes
		apply(e.matches ? "dark" : "light");
	});
})();
