// Closes the mobile hamburger nav (.nav-toggle, a native <details>) when a
// visitor clicks/taps outside of it while it's open. Native <details> only
// closes via clicking its own <summary> again — there's no built-in "close
// on outside click" behavior, and no pure-CSS way to detect a click outside
// an element, so this is genuinely new behavior that needs JS (the base
// open/close toggle itself stays zero-JS, per CODING_STANDARDS.md).
//
// Listens for "pointerdown", not "click" — confirmed via manual testing
// (WebKit/Safari, real touch emulation) that tapping a plain, non-
// interactive element (e.g. a page heading) fires touchstart/touchend but
// *no* click event at all; WebKit only synthesizes a click from a touch
// tap on elements it treats as interactive (links, buttons, form
// controls, <summary>...). A click-based listener would never see most
// outside taps on Safari/iOS — exactly the browsers this fix most needs
// to work on. "pointerdown" fires for every tap regardless of what's
// tapped, on every engine tested (Chromium and WebKit).
//
// Race-safe against the tap that *opens* the menu: "pointerdown" fires
// well before <details>'s native toggle (which is <summary>'s "click"
// event's activation behavior, happening later in the sequence) — so at
// the point this bubble-phase listener runs, .open still reflects the
// *pre-tap* state. On the opening tap .open is still false, so the
// condition below is false and this listener is a no-op; the native
// toggle then opens it as normal. On a second tap directly on the
// summary, .open is true but the target is inside .nav-toggle, so this
// is a no-op there too — native toggling closes it instead.
(function () {
	const navToggle = document.querySelector(".nav-toggle");
	if (!navToggle) return;

	document.addEventListener("pointerdown", (event) => {
		if (navToggle.open && !navToggle.contains(event.target)) {
			navToggle.open = false;
		}
	});
})();
