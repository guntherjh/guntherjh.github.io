// Persists which About page sections (About Me / About this site) are
// expanded across page loads via localStorage. Native vanilla JS, no
// dependency — per CODING_STANDARDS.md, this is JS used only because native
// <details> has no cross-page-load persistence mechanism of its own.
//
// Degrades gracefully: with JS disabled (or localStorage unavailable, e.g.
// private browsing), sections still expand/collapse via native <details>
// behavior — they just don't remember state between visits.
(function () {
    const STORAGE_KEY = "about-expanded-sections";
    const sections = document.querySelectorAll(".about-section");

    function loadExpanded() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveExpanded() {
        const open = Array.from(sections)
            .filter((section) => section.open)
            .map((section) => section.dataset.section);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
        } catch {
            // localStorage unavailable — sections still work, just won't persist.
        }
    }

    const expanded = loadExpanded();
    sections.forEach((section) => {
        if (expanded.indexOf(section.dataset.section) !== -1) {
            section.open = true;
        }
        section.addEventListener("toggle", saveExpanded);
    });
})();
