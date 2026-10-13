/**
 * Meteor field — the diagonal streaks behind the hero.
 *
 * Pure CSS on a server component, so it costs nothing at runtime and cannot
 * jank the main thread. Positions and timings are derived from the index rather
 * than random, because Math.random() during render produces different values on
 * server and client and trips a hydration mismatch.
 *
 * Each streak is a thin gradient line travelling down-left, with a fade at both
 * ends so it reads as motion rather than as a drawn diagonal.
 */

const COUNT = 18;

export function Meteors({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {Array.from({ length: COUNT }, (_, i) => {
        // Deterministic spread: golden-ratio stepping avoids the clumping a
        // plain modulo gives, without needing randomness.
        const left = (i * 61.8) % 100;
        const top = (i * 37.5) % 60;
        const delay = (i * 0.73) % 8;
        const duration = 4 + ((i * 1.7) % 5);
        // Longer and thicker than the first pass, which read as too subtle
        // to register as a deliberate element rather than a rendering artifact.
        const length = 140 + ((i * 30) % 130);
        const thickness = 1.5 + (i % 3) * 0.5;

        return (
          <span
            key={i}
            className="animate-meteor absolute origin-left rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${length}px`,
              height: `${thickness}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              background:
                "linear-gradient(90deg, transparent, rgb(var(--accent) / 0.8), transparent)",
            }}
          />
        );
      })}
    </div>
  );
}
