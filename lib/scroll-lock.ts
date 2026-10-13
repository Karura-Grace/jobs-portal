/**
 * Reference-counted body scroll lock.
 *
 * Drawer, ConfirmAction and the mobile nav menu can all lock scroll, and a
 * confirm dialog routinely opens on top of an already-open drawer. Each one
 * independently saving and restoring `document.body.style.overflow` breaks
 * the moment two are open at once — whichever closes first "restores" a
 * value that is now wrong for the one still open, leaving scroll either
 * stuck hidden or unlocked too early. A shared counter means only the last
 * lock to release actually restores the original value.
 */
let count = 0;
let previousOverflow = "";

export function lockScroll() {
  if (count === 0) previousOverflow = document.body.style.overflow;
  count++;
  document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  count = Math.max(0, count - 1);
  if (count === 0) document.body.style.overflow = previousOverflow;
}
