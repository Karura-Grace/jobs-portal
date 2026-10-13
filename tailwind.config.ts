import type { Config } from "tailwindcss";

/**
 * Colours are CSS variables holding raw RGB triples, so `rgb(var(--x) /
 * <alpha-value>)` keeps Tailwind's opacity modifiers working (`bg-surface/60`).
 * Values live in app/globals.css under :root and .dark.
 *
 * The legacy `pac-*` names are deliberately kept and re-pointed at the same
 * variables. Every page written before this redesign becomes theme-aware with
 * no edits, so the dashboards keep working while the public pages are rebuilt
 * one at a time rather than the app sitting broken in between.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",

        // The brand orange. `accent` is for fills, borders, rings and icons.
        // `accent-text` is the same hue adjusted per mode so orange TEXT clears
        // 4.5:1 — #E8532E is 4.82:1 on the dark surface but only 3.68:1 on
        // white, which would fail the AA requirement in light mode.
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-text": "rgb(var(--accent-text) / <alpha-value>)",

        // Legacy aliases — same variables, so old pages theme correctly.
        pac: {
          orange: "rgb(var(--accent) / <alpha-value>)",
          "orange-dark": "rgb(var(--accent-text) / <alpha-value>)",
          "orange-tint": "rgb(var(--accent-tint) / <alpha-value>)",
          ink: "rgb(var(--text) / <alpha-value>)",
          paper: "rgb(var(--bg) / <alpha-value>)",
          stone: "rgb(var(--surface-raised) / <alpha-value>)",
          line: "rgb(var(--line) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
          faint: "rgb(var(--text-faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontWeight: { 400: "400", 500: "500", 600: "600", 700: "700" },
      letterSpacing: {
        display: "-0.021em",
        tight: "-0.011em",
        label: "0.14em",
      },
      borderRadius: {
        clay: "16px",
        card: "12px",
        pill: "9999px",
      },
      boxShadow: {
        clay: "var(--clay-shadow)",
        "clay-lifted": "var(--clay-shadow-lifted)",
        "clay-inset": "var(--clay-shadow-inset)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      keyframes: {
        "mesh-drift": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(3%,-2%,0) scale(1.06)" },
          "66%": { transform: "translate3d(-2%,3%,0) scale(1.03)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Diagonal streak, down and to the left, fading at both ends.
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "0" },
          "12%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "rotate(215deg) translateX(-620px)", opacity: "0" },
        },
        // The arrow nudge on the secondary CTA.
        nudge: {
          "0%,100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(3px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        // 12s cycle, per the brief.
        "mesh-drift": "mesh-drift 12s ease-in-out infinite",
        "fade-up": "fade-up 320ms cubic-bezier(0.23, 1, 0.32, 1) both",
        meteor: "meteor 5s linear infinite",
        nudge: "nudge 1.6s ease-in-out infinite",
        // The footer's dotted-circle motif — a CSS echo of the hero globe,
        // not a second WebGL instance. Slow enough to read as ambient rather
        // than as something demanding attention down where nobody scrolls to
        // watch it.
        "spin-slow": "spin-slow 16s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
