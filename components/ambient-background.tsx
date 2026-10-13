/**
 * The ambient layer: noise grain over a slowly drifting gradient mesh.
 *
 * Deliberately a server component with no JavaScript — it is CSS animation on
 * two fixed layers, so it costs nothing at runtime and cannot jank the main
 * thread. The brief asks for one 12s cycle, no particles, no bouncing.
 *
 * `aria-hidden` and `pointer-events-none` throughout: it is decoration and must
 * never be reachable by a screen reader or intercept a click.
 *
 * Under prefers-reduced-motion the drift stops (globals.css neutralises
 * animation) but the mesh stays — it is a static wash at that point, which
 * keeps the depth without the movement that causes trouble.
 *
 * The grain is an inline SVG feTurbulence data URI rather than an image file:
 * no extra request, and it scales to any viewport.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Gradient mesh — three soft blobs, drifting out of phase. Muted accent
          against the page background, never bright enough to compete with
          content. */}
      <div className="absolute inset-0 animate-mesh-drift">
        <div
          className="absolute -left-[15%] -top-[10%] h-[70vh] w-[70vw] rounded-full blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--accent) / 0.16) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -right-[10%] top-[20%] h-[60vh] w-[55vw] rounded-full blur-[110px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--accent) / 0.10) 0%, transparent 70%)",
            animationDelay: "-4s",
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[25%] h-[55vh] w-[60vw] rounded-full blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--accent) / 0.07) 0%, transparent 70%)",
            animationDelay: "-8s",
          }}
        />
      </div>

      {/* Grain at 4% — enough to kill the plastic look of a pure gradient. */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
