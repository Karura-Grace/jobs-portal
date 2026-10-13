"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useTheme } from "next-themes";
import { useReducedMotion } from "framer-motion";

/**
 * The dotted globe under the hero.
 *
 * WHAT THE MARKERS SAY. Nairobi is the anchor — one large, slowly pulsing dot,
 * and the only one in the brand accent colour — and everything else is a small
 * uniform grey dot on a major city on five other continents. That is the claim
 * the business actually makes: based in Nairobi, placing people with employers
 * here and abroad. Kenya gets one dot rather than five, because a cluster of
 * Kenyan towns read as noise at this size and buried the point. A handful of
 * pulsing arcs run from Nairobi to Lagos, Dubai, London and Mumbai — a sample
 * of the network, not the whole thing, since every marker connected would read
 * as a tangle rather than a route map.
 *
 * INTERACTION. Drag to spin. Auto-rotation stops the instant a pointer goes
 * down, tracking is 1:1 with the finger, and on release the pointer's velocity
 * is handed to the spin and then eased back into the ambient drift — so there is
 * no seam between dragging and animating, and no hard stop. `touch-action:
 * pan-y` is deliberate: a horizontal drag spins the globe while a vertical swipe
 * still scrolls the page, which `none` would have broken on every phone.
 *
 * PERFORMANCE. This is decoration on the busiest page, so it is built to cost
 * as little as possible:
 *
 *   - The render loop stops entirely when the globe scrolls out of view, and
 *     when the tab is hidden. A hero canvas spinning behind three screens of
 *     content is pure battery drain.
 *   - devicePixelRatio is capped at the real one rather than hardcoded to 2,
 *     which was oversampling 4× on ordinary 1× displays.
 *   - mapSamples scales with the rendered width: a 600px globe on a phone does
 *     not need the dot density of a 980px one on a desktop.
 *   - One requestAnimationFrame loop, one globe.update() per frame, and the
 *     marker array is mutated in place rather than rebuilt.
 *   - Under prefers-reduced-motion nothing auto-rotates and nothing pulses; a
 *     single frame is drawn and left. Dragging still works, because that motion
 *     is asked for rather than imposed.
 */

type Marker = { location: [number, number]; size: number; color?: [number, number, number] };

/** Nairobi first — the pulse mutates index 0 in place. */
const NAIROBI_BASE = 0.052;
const NAIROBI_LOCATION: [number, number] = [-1.2921, 36.8219];
/** The one and only accent-coloured point on the globe — see MARKERS below. */
const ACCENT: [number, number, number] = [0.91, 0.33, 0.18];
/** Every other city marker, muted rather than sharing Nairobi's colour. */
const CITY_MARKER_COLOR: [number, number, number] = [0.58, 0.56, 0.52];

const MARKERS: Marker[] = [
  // Nairobi is the only accent-coloured marker on the globe — everywhere
  // else is muted grey. Sharing the colour with 20 other dots buried the
  // one the business is actually anchored on; the pulse alone was not
  // enough distinction once you looked for more than a second.
  { location: NAIROBI_LOCATION, size: NAIROBI_BASE, color: ACCENT }, // Nairobi — the anchor
  // Africa
  { location: [6.5244, 3.3792], size: 0.021 }, // Lagos
  { location: [30.0444, 31.2357], size: 0.021 }, // Cairo
  { location: [-26.2041, 28.0473], size: 0.021 }, // Johannesburg
  { location: [9.032, 38.7469], size: 0.021 }, // Addis Ababa
  { location: [5.6037, -0.187], size: 0.018 }, // Accra
  // Named in the hero copy, so it is on the globe — the two should agree.
  { location: [-33.9249, 18.4241], size: 0.018 }, // Cape Town
  { location: [-6.7924, 39.2083], size: 0.018 }, // Dar es Salaam
  // Middle East
  { location: [25.2048, 55.2708], size: 0.021 }, // Dubai
  { location: [24.7136, 46.6753], size: 0.018 }, // Riyadh
  { location: [25.2854, 51.531], size: 0.016 }, // Doha
  // Europe
  { location: [51.5074, -0.1278], size: 0.021 }, // London
  { location: [52.52, 13.405], size: 0.018 }, // Berlin
  { location: [48.8566, 2.3522], size: 0.018 }, // Paris
  // Asia
  { location: [19.076, 72.8777], size: 0.021 }, // Mumbai
  { location: [1.3521, 103.8198], size: 0.018 }, // Singapore
  { location: [22.3193, 114.1694], size: 0.018 }, // Hong Kong
  { location: [35.6762, 139.6503], size: 0.021 }, // Tokyo
  // Americas and Oceania
  { location: [40.7128, -74.006], size: 0.021 }, // New York
  { location: [43.6532, -79.3832], size: 0.018 }, // Toronto
  { location: [-23.5505, -46.6333], size: 0.018 }, // São Paulo
  { location: [-33.8688, 151.2093], size: 0.018 }, // Sydney
];

/**
 * A handful of Nairobi's routes, not all twenty — every marker connected
 * would read as a tangle rather than a network. These four are also the
 * ones the hero and About copy actually name (Lagos, Dubai, London,
 * Mumbai stand in for the Gulf and Asia legs), so the globe agrees with
 * the words next to it.
 */
const ARC_TARGETS: [number, number][] = [
  [6.5244, 3.3792], // Lagos
  [25.2048, 55.2708], // Dubai
  [51.5074, -0.1278], // London
  [19.076, 72.8777], // Mumbai
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Longitude offset so East Africa faces the viewer on load. */
const START_PHI = 4.1;
/** Radians per frame of ambient drift. */
const AUTO_SPIN = 0.0016;
/** Radians per pixel dragged. */
const DRAG_SCALE = 0.006;
/** Ceiling on flung momentum, so a hard swipe cannot blur the whole globe. */
const MAX_SPIN = 0.05;

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const reduced = useReducedMotion();
  const isDark = resolvedTheme !== "light";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // `createGlobe()` below generates cobe's dot map synchronously — up to
    // 26k points of spherical projection — which was measured (Lighthouse,
    // 4x CPU throttle) blocking the main thread for multiple seconds right
    // in the window that decides Time to Interactive and Total Blocking
    // Time. Deferring it to an idle callback keeps that cost off the
    // critical path: the rest of the page becomes interactive first, and
    // the globe fills in a beat later rather than holding everything else
    // hostage to its own setup cost. `requestIdleCallback` has no Safari
    // support, hence the timeout fallback.
    let cancelled = false;
    let teardown = () => {};
    const idle: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback.bind(window)
        : (cb) => window.setTimeout(cb, 1);
    const cancelIdle: (id: number) => void =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback.bind(window)
        : window.clearTimeout;

    const idleId = idle(() => {
      if (!cancelled) teardown = setup(canvas);
    });

    // Takes the canvas as a parameter rather than closing over the outer
    // `canvas` const — TS's null-narrowing from the guard above does not
    // carry across the async boundary of the idle callback, since it
    // cannot prove the ref is still non-null by the time this actually runs.
    function setup(canvas: HTMLCanvasElement) {
      let phi = START_PHI;
      let spin = reduced ? 0 : AUTO_SPIN;
      let width = canvas.offsetWidth || 600;
      let frame = 0;
      let running = false;
      let visible = true;
      let elapsed = 0;

      // Drag state.
      let dragging = false;
      let lastX = 0;
      let lastAt = 0;
      let pointerVelocity = 0;

      // Mutated in place by the pulse — never reallocated.
      const markers = MARKERS.map((m) => ({ ...m }));
      // Same discipline for arcs — tick() overwrites .color on these in place.
      const arcs = ARC_TARGETS.map((to) => ({ from: NAIROBI_LOCATION, to, color: ACCENT }));
      const bgColor: [number, number, number] = isDark
        ? [0.14, 0.14, 0.135]
        : [0.962, 0.962, 0.945];

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // ~16k dots at phone width, ~26k at desktop. Below about 12k the coastlines
      // stop being recognisable, which is the whole point of the thing.
      const samples = Math.round(Math.min(26000, Math.max(12000, width * 27)));

      const globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: width * dpr,
        height: width * dpr,
        phi,
        // Negative theta looks up from just below the equator, lifting it above
        // the sphere's centre. Originally so the stacked hero's cropped bottom
        // half still kept the equator (and Nairobi) in the visible arc; the
        // hero shows the full sphere now, but the tilt still reads better than
        // dead-on, so it stayed.
        theta: -0.12,
        dark: isDark ? 1 : 0,
        // Low diffuse in both modes, which is what makes this read as continents
        // rather than as a ball. `diffuse` is the directional shading; at 1.0 it
        // darkens the sphere towards its edges and the silhouette becomes a solid
        // disc — in light mode that looked like a white balloon with the map
        // barely visible on it. Flattened, the sphere sits at almost exactly the
        // page background and only the dots read.
        diffuse: isDark ? 0.9 : 0.28,
        mapSamples: samples,
        // cobe multiplies baseColor by mapBrightness to get the land dots, so the
        // sign of the contrast is set by whether mapBrightness is above or below
        // 1. Light mode therefore needs a bright sphere and a brightness BELOW 1
        // to get dark dots — above 1 clips them to white, which is why the
        // continents were invisible on the bone background.
        mapBrightness: isDark ? 5.6 : 0.4,
        // Matched to --bg in each mode (10,10,10 and 245,245,240) so the sphere
        // disappears into the page and the dots do the work.
        baseColor: isDark ? [0.14, 0.14, 0.135] : [0.962, 0.962, 0.945],
        // Muted — Nairobi carries the brand colour alone now (see MARKERS).
        markerColor: CITY_MARKER_COLOR,
        glowColor: isDark ? [0.09, 0.09, 0.09] : [0.962, 0.962, 0.945],
        markers,
        arcs,
        arcWidth: 1.1,
        arcHeight: 0.35,
      });

      const draw = () => {
        globe.update({ phi, markers, arcs });
      };

      const tick = () => {
        if (!dragging) {
          phi += spin;
          // Ease whatever momentum the release left behind back into the ambient
          // drift, rather than cutting from one to the other.
          spin += (AUTO_SPIN - spin) * 0.03;
        }
        // Nairobi breathes. ±20% over roughly three seconds — enough to draw the
        // eye, slow enough not to nag.
        elapsed += 1;
        markers[0].size = NAIROBI_BASE * (1 + 0.2 * Math.sin(elapsed / 28));

        // Arcs pulse rather than sit static — a signal travelling the network,
        // not a fixed line drawn on it. Cobe's arc colour has no alpha channel,
        // so "fading" is faked by lerping toward the background colour, the
        // same trick the sphere itself uses to disappear into the page.
        // Staggered per arc (the `i` term) so they read as separate pulses
        // instead of one globe-wide flash.
        arcs.forEach((arc, i) => {
          const phase = elapsed / 90 + i / arcs.length;
          const brightness = 0.35 + 0.65 * ((Math.sin(phase * Math.PI * 2) + 1) / 2);
          arc.color = lerpColor(bgColor, ACCENT, brightness);
        });

        draw();
        frame = requestAnimationFrame(tick);
      };

      const start = () => {
        if (running || !visible) return;
        running = true;
        frame = requestAnimationFrame(tick);
      };

      const stop = () => {
        running = false;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      };

      // ── Pointer ────────────────────────────────────────────────
      const onDown = (event: PointerEvent) => {
        dragging = true;
        spin = 0; // Respond on pointer-down, not on release.
        lastX = event.clientX;
        lastAt = event.timeStamp;
        pointerVelocity = 0;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        // A drag must keep painting even where the ambient loop is stopped.
        start();
      };

      const onMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dt = Math.max(1, event.timeStamp - lastAt);
        const delta = dx * DRAG_SCALE;
        phi += delta;
        // Radians per millisecond, from the last move only — a longer history
        // would smooth over the flick the user actually ended on.
        pointerVelocity = delta / dt;
        lastX = event.clientX;
        lastAt = event.timeStamp;
        if (!running) draw();
      };

      const onUp = (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        canvas.releasePointerCapture(event.pointerId);
        canvas.style.cursor = "grab";
        // Hand the pointer's velocity to the spin at ~16ms per frame, so the
        // animation continues at the speed the finger left.
        const flung = pointerVelocity * 16;
        spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, flung));
        if (reduced) {
          // No ambient drift to settle into, so let the throw decay and stop.
          spin = 0;
          draw();
          stop();
        }
      };

      canvas.style.cursor = "grab";
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);

      // ── Resize ─────────────────────────────────────────────────
      const onResize = () => {
        if (!canvasRef.current) return;
        width = canvasRef.current.offsetWidth || width;
        globe.update({ width: width * dpr, height: width * dpr });
      };
      window.addEventListener("resize", onResize, { passive: true });

      // ── Only render when it can actually be seen ───────────────
      const observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (!visible) stop();
          else if (!reduced) start();
          else draw();
        },
        { rootMargin: "120px" }
      );
      observer.observe(canvas);

      const onVisibility = () => {
        if (document.hidden) stop();
        else if (!reduced && visible) start();
      };
      document.addEventListener("visibilitychange", onVisibility);

      if (reduced) draw();
      else start();

      return () => {
        stop();
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        globe.destroy();
      };
    }

    return () => {
      cancelled = true;
      cancelIdle(idleId);
      teardown();
    };
  }, [isDark, reduced]);

  return (
    <canvas
      ref={canvasRef}
      // Not aria-hidden any more: it is an interactive control, so it needs a
      // name. There is nothing here a keyboard user is missing — every place the
      // markers stand for is reachable through the location filter on /jobs — so
      // it is not in the tab order.
      role="img"
      aria-label="Rotating globe marking Nairobi and other cities PAC Africa places people in. Drag to spin."
      className="aspect-square h-auto w-full touch-pan-y select-none"
      style={{ contain: "layout paint size" }}
    />
  );
}
