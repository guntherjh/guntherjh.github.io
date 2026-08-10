// Persists which About page sections (About Me / About this site / Resume)
// are expanded across page loads via localStorage. Native vanilla JS, no
// dependency — per CODING_STANDARDS.md, this is JS used only because native
// <details> has no cross-page-load persistence mechanism of its own.
//
// Degrades gracefully: with JS disabled (or localStorage unavailable, e.g.
// private browsing), sections still expand/collapse via native <details>
// behavior — they just don't remember state between visits.
(function () {
  var STORAGE_KEY = "about-expanded-sections";
  var sections = document.querySelectorAll(".about-section");

  function loadExpanded() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveExpanded() {
    var open = Array.prototype.filter
      .call(sections, function (section) { return section.open; })
      .map(function (section) { return section.dataset.section; });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch (e) {
      // localStorage unavailable — sections still work, just won't persist.
    }
  }

  var expanded = loadExpanded();
  sections.forEach(function (section) {
    if (expanded.indexOf(section.dataset.section) !== -1) {
      section.open = true;
    }
    section.addEventListener("toggle", saveExpanded);
  });
})();
