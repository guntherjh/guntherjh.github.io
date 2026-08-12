// Persists which Resume page sections (Work Experience / Education /
// Skills / Contact) are collapsed across page loads via localStorage.
// Native vanilla JS, no dependency — per CODING_STANDARDS.md, this is
// JS used only because native <details> has no cross-page-load
// persistence mechanism of its own. Same pattern as
// src/js/about-sections.js.
//
// Unlike about-sections.js, these sections start OPEN by default (see
// the `open` attribute in resume.njk) — arriving at /resume/ is
// already an intentional "show me the resume" action. So this script
// tracks which sections a visitor has explicitly COLLAPSED, not which
// they've expanded, and only overrides the default to close those.
//
// Degrades gracefully: with JS disabled (or localStorage unavailable,
// e.g. private browsing), sections still expand/collapse via native
// <details> behavior and start open per their `open` attribute — they
// just don't remember a visitor's collapse choices between visits.
(function () {
	const STORAGE_KEY = "resume-collapsed-sections";
	const sections = document.querySelectorAll(".resume-section");

	function loadCollapsed() {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
		} catch {
			return [];
		}
	}

	function saveCollapsed() {
		const collapsed = Array.from(sections)
			.filter((section) => !section.open)
			.map((section) => section.dataset.section);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
		} catch {
			// localStorage unavailable — sections still work, just won't persist.
		}
	}

	const collapsed = loadCollapsed();
	sections.forEach((section) => {
		if (collapsed.indexOf(section.dataset.section) !== -1) {
			section.open = false;
		}
		section.addEventListener("toggle", saveCollapsed);
	});
})();
