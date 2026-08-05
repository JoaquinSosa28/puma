/**
 * "Play it again", without the round trip.
 *
 * The button and the overlay are in different trees — one is a card in
 * Settings, the other lives in the app layout — so this is the wire between
 * them. Deliberately a window event rather than context: the overlay is
 * mounted on every page and has no business re-rendering because a settings
 * card exists.
 *
 * The point is that pressing the button opens the tour on the frame you press
 * it. It used to clear a flag in the database, wait for that, navigate home,
 * and refresh — three round trips before anything appeared, which on a slow
 * link is a button that looks broken. The tour records itself the moment it
 * starts, so the write can happen afterwards, in the background, unwatched.
 */
const EVENT = "pumma:tutorial-replay";

export function requestTutorialReplay(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onTutorialReplay(run: () => void): () => void {
  window.addEventListener(EVENT, run);
  return () => window.removeEventListener(EVENT, run);
}
