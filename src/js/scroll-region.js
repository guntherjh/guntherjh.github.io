// Scroll regions (Lighthouse widget table, guntherjh/guntherjh.github.io#184):
// tabindex="0" only while a .scroll-region is actually overflowing. A
// region that isn't currently causing overflow (e.g. below the Lighthouse
// widget's 640px stacked-card breakpoint, where the table reflows and
// nothing scrolls) would otherwise be a dead tab stop for keyboard users —
// see CODING_STANDARDS.md's Accessibility section. HTML/CSS alone can't
// express "focusable only if overflowing" (no selector reacts to an
// element's own scrollWidth vs. clientWidth), so this is genuinely new
// behavior that needs JS, same exception CODING_STANDARDS.md's JavaScript
// section carves out for nav-toggle.js/about-sections.js.
//
// ResizeObserver, not a window "resize" listener: this widget sits inside
// a collapsed <details class="about-section"> at page load, so it's 0×0
// until a visitor opens that section — a "resize" listener would never
// fire for that transition, leaving the table overflowing with no
// tabindex until the visitor separately resized the window. ResizeObserver
// reports every box-size change for an observed element, including
// display:none → visible, so opening the <details> alone re-triggers a
// sync. It also only fires once per render step, unlike "resize" firing
// repeatedly mid-drag.
(function () {
	const regions = document.querySelectorAll(".scroll-region");
	if (regions.length === 0) return;

	function sync(region) {
		if (region.scrollWidth > region.clientWidth) {
			region.setAttribute("tabindex", "0");
		} else {
			region.removeAttribute("tabindex");
		}
	}

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			sync(entry.target);
		}
	});
	regions.forEach((region) => observer.observe(region));
})();
