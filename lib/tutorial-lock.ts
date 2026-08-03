// While the tour is on screen, the app underneath must stop listening.
//
// The overlay covers everything, so pointers are already dealt with — a click
// can't reach the app behind a full-screen fixed layer. Keyboards don't work
// like that. The capture bar listens on `window` for Tab (to cycle what you're
// making) and for any single character (to catch type-anywhere), and neither
// cares that something is drawn on top: pressing Tab during the tour's Tab
// mission was cycling the real bar behind it at the same time.
//
// A module flag rather than a context because every one of these listeners is
// imperative and lives in a different component; they can all read it at event
// time without anything being threaded through props.

let active = false;

export function setTutorialActive(next: boolean): void {
  active = next;
  if (typeof document !== "undefined") {
    // Mirrored onto the document so CSS and anything outside React can see it.
    if (next) document.documentElement.dataset.tutorial = "on";
    else delete document.documentElement.dataset.tutorial;
  }
}

/** True while the tour owns the keyboard. App-level handlers must bail out. */
export function isTutorialActive(): boolean {
  return active;
}
