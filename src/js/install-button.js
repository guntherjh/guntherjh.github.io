// PWA install button (guntherjh/guntherjh.github.io#146). Reveals the two
// .install-button copies in the header (desktop controls + mobile panel —
// see base.njk) only once the browser has actually offered a programmatic
// install, then triggers that install on click. Chromium-only by nature:
// Safari/iOS and Firefox never fire `beforeinstallprompt`, so the buttons
// stay hidden there and installing stays on the browser's own Share /
// "Add to Home Screen" affordance. Pure progressive enhancement — if none
// of this runs, the buttons are simply never unhidden.
//
// The `beforeinstallprompt` capture itself is a tiny inline script in
// base.njk's <head>, not here: the event can fire before this deferred
// file executes and can't be retrieved after the fact, so it's stashed
// early onto window.__installPromptEvent (same inline-capture pattern as
// the pre-paint theme script). This file consumes that, and also keeps
// its own listener for the case where the event fires later.
(function () {
	// Already running as an installed app — there's nothing to offer.
	if (
		window.matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true
	) {
		return;
	}

	const buttons = document.querySelectorAll(".install-button");
	if (!buttons.length) return;

	let promptEvent = window.__installPromptEvent || null;

	function setHidden(hidden) {
		buttons.forEach((button) => {
			button.hidden = hidden;
		});
	}

	if (promptEvent) setHidden(false);

	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		promptEvent = event;
		setHidden(false);
	});

	buttons.forEach((button) => {
		button.addEventListener("click", async () => {
			if (!promptEvent) return;
			const event = promptEvent;
			// A given `beforeinstallprompt` can be prompt()ed only once —
			// drop our reference now, whatever the visitor chooses. A
			// dismissal therefore leaves the buttons visible but inert
			// for the rest of this page view; Chrome re-fires
			// `beforeinstallprompt` on the next full page load (this is a
			// multi-page site), which re-arms them.
			promptEvent = null;
			try {
				event.prompt();
				const { outcome } = await event.userChoice;
				// Installed: hide the buttons (`appinstalled` fires too,
				// but don't let them linger for a frame).
				if (outcome === "accepted") setHidden(true);
			} catch {
				// prompt()/userChoice can reject (event already spent,
				// browser-internal failure). Progressive enhancement —
				// swallow it silently like register-sw.js does rather
				// than surfacing a console error.
			}
		});
	});

	// Installed through the browser's own UI (or ours) — make sure the
	// buttons are gone.
	window.addEventListener("appinstalled", () => {
		promptEvent = null;
		setHidden(true);
	});
})();
