import Image from "next/image";
import { site } from "@/lib/content";

/**
 * The PAC mark.
 *
 * THE STRAPLINE IS CROPPED OFF, deliberately. `public/pac-logo.png` is 591×221
 * and "PRIORITY ACTIVATOR CONSULTING" occupies the bottom ~28% of it — about
 * 18px of a 221px image. Rendered at a header-appropriate 28px tall that
 * strapline is roughly two pixels high: not small, illegible, and it read as a
 * grey smudge that made the whole mark look squeezed. There is no size at which
 * it works in a nav bar, so it is cut rather than shrunk, and the mark is then
 * set larger with the space that frees up.
 *
 * The crop is done with overflow rather than by editing the asset, so the
 * original stays intact for print and for anywhere it has room to breathe.
 *
 * DARK MODE. Both the X figure and the strapline are solid black, so on the
 * charcoal background the figure all but disappeared while the orange wordmark
 * stayed put — the mark looked broken rather than dark-themed. `invert` flips
 * the black to white, and the following `hue-rotate(180deg)` puts the hue back
 * roughly where it started, so the wordmark stays orange instead of going cyan.
 * It is an approximation — CSS hue-rotate is a matrix, not a true HSL rotation —
 * and it was checked against both themes rather than assumed.
 *
 * The real fix is a wordmark-only asset with a light variant. This gets the mark
 * legible today without inventing brand assets.
 */

/**
 * Where to cut, measured off the asset rather than guessed: the "PAC" wordmark
 * ends at y=169, the strapline runs y=180–203, and the X figure's legs reach
 * y=203 — the strapline sits between them. So no crop keeps the whole figure and
 * loses the strapline; 174 takes the wordmark with five pixels of air, drops the
 * strapline completely, and trims the very ends of the X's legs, which reads as
 * a tighter mark rather than a broken one.
 */
const CROP_AT = 174;
const SOURCE_W = 591;
const SOURCE_H = 221;
const KEPT = CROP_AT / SOURCE_H;
/** Aspect ratio of the visible crop. */
const RATIO = SOURCE_W / (SOURCE_H * KEPT);

export function Logo({
  height = 30,
  className,
  priority = false,
}: {
  /** Rendered height in px of the cropped mark. */
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className ?? ""}`}
      style={{ height, width: Math.round(height * RATIO) }}
    >
      <Image
        src="/pac-logo.png"
        alt={site.owner}
        width={SOURCE_W}
        height={SOURCE_H}
        priority={priority}
        className="absolute left-0 top-0 w-full dark:[filter:invert(1)_hue-rotate(180deg)]"
      />
    </span>
  );
}
