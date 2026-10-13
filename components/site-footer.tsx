import Link from "next/link";
import { Logo } from "@/components/logo";
import { footer, nav, site } from "@/lib/content";

/**
 * Social links and a phone number don't exist yet — no real accounts or
 * support line to point to. Rendered as inert placeholders rather than
 * either omitting them or wiring up dead `href="#"` anchors: no `href` at
 * all, so nothing crawls into or tab-stops onto a target that goes nowhere.
 * Swap `PLACEHOLDER_SOCIALS` for real hrefs (and the phone span for a real
 * `tel:` link) the day these exist.
 */
const PLACEHOLDER_SOCIALS = ["", ""];

/**
 * `py-1.5` isn't visual padding so much as touch-target padding — Lighthouse
 * flagged these at 16px tall against a 24px minimum. The line height alone
 * read fine to the eye; it just wasn't a large enough hit area.
 */
const FOOTER_LINK = "py-1.5 text-muted transition-colors duration-150 ease-out hover:text-ink";

/**
 * Deliberately thin — one compact row rather than the two stacked, padded
 * blocks this used to be. A footer only needs to be found, not dwelt in.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 px-4 pb-4">
      <div className="clay mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-xs md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2">
        <div className="flex items-center gap-3">
          <Logo height={24} />
          {/* A CSS echo of the hero globe, not a second WebGL canvas — a
              dotted-circle motif ties the footer back to it visually for
              near zero cost. Masked to a soft circular fade so it reads as
              a small sphere rather than a clipped dot grid. */}
          <span
            aria-hidden
            className="hidden h-6 w-6 shrink-0 rounded-full opacity-60 motion-safe:animate-spin-slow sm:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(var(--accent)) 1px, transparent 1.4px)",
              backgroundSize: "5px 5px",
              maskImage: "radial-gradient(circle, black 55%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(circle, black 55%, transparent 100%)",
            }}
          />
          <p className="text-muted">{footer.rights(new Date().getFullYear())}</p>
        </div>

        {/* prefetch off on all six: this footer renders on every page, so
            without it every single pageview fires six extra RSC-prefetch
            edge requests for links most visitors never click. */}
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-0 md:ml-auto">
          <Link href="/jobs" className={FOOTER_LINK} prefetch={false}>
            {nav.browse}
          </Link>
          <Link href="/for-talent" className={FOOTER_LINK} prefetch={false}>
            {nav.forTalent}
          </Link>
          <Link href="/employers" className={FOOTER_LINK} prefetch={false}>
            {nav.forEmployers}
          </Link>
          <Link href="/about" className={FOOTER_LINK} prefetch={false}>
            {nav.about}
          </Link>
          {/* Required to be reachable from every page — we hold CVs. */}
          <Link href="/privacy" className={FOOTER_LINK} prefetch={false}>
            Data &amp; cookies
          </Link>
          <Link href="/terms" className={FOOTER_LINK} prefetch={false}>
            Terms
          </Link>
        </nav>

        {/* text-muted, not text-faint — this is real text content (a
            placeholder label, but still text a visitor reads), and faint
            failed Lighthouse's AA contrast check here. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-muted md:w-full md:justify-end md:border-t md:border-line md:pt-2">
          <a href="mailto:hello@pac.africa" className={FOOTER_LINK}>
            info@pac.africa
          </a>
          <span className="py-1.5"></span>
          {PLACEHOLDER_SOCIALS.map((label, i) => (
            <span key={i} className="py-1.5">{label} </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
