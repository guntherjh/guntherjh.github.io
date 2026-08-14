// Registers the offline-support service worker (see /sw.js and
// guntherjh/guntherjh.github.io#5). Deferred to the window `load` event so
// registration doesn't compete with the initial page load for bandwidth or
// main-thread time (see CODING_STANDARDS.md's "Be deliberate about the main
// thread").
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Offline support is a progressive enhancement — a failed
			// registration (unsupported browser quirk, blocked storage, a
			// private-browsing restriction) shouldn't be surfaced to the
			// visitor or break anything else on the page.
		});
	});
}
