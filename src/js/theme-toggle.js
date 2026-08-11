// Theme toggle: binary light/dark, defaults to system prefers-color-scheme
// until the visitor explicitly overrides it, sticky localStorage override
// once set. Initial theme is decided by an inline pre-paint script in
// base.njk (to avoid a flash of the wrong theme) — this file only owns
// the interactive part: the click handler, persisting the override, and
// following system-preference changes while no override is stored.
// Same native localStorage pattern as src/js/about-sections.js.
(function () {
    var STORAGE_KEY = "theme";
    var toggle = document.querySelector(".theme-toggle");
    var media = matchMedia("(prefers-color-scheme: dark)");

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
        var isDark = theme === "dark";
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light theme" : "Switch to dark theme",
        );
    }

    // Sync aria state with whatever the pre-paint script already applied.
    apply(document.documentElement.getAttribute("data-theme"));

    toggle.addEventListener("click", function () {
        var next =
            document.documentElement.getAttribute("data-theme") === "dark"
                ? "light"
                : "dark";
        setStored(next);
        apply(next);
    });

    media.addEventListener("change", function (e) {
        if (getStored()) return; // explicit override is sticky, ignore system changes
        apply(e.matches ? "dark" : "light");
    });
})();
