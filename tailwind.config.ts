import type { Config } from "tailwindcss";

const config: Config = {
  // Class-based so a future light/dark toggle just adds/removes "dark" on
  // <html> (see app/layout.tsx) — for now the app always renders with it on,
  // making dark the permanent default per the brand kit. Most of the actual
  // dark-mode color mapping lives in globals.css as plain ".dark .bg-..."
  // overrides of the existing slate/white/status classes (the app already
  // centralizes on Tailwind's default gray scale everywhere), rather than a
  // dark: variant added to every className in every component.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // True Ultimate Training brand guide v1 (Oct 2026) — "Cone" orange
        // and "Asphalt" dark grey. This is a colors-and-fonts-only pass (see
        // app/layout.tsx and globals.css): the guide's full phase-color
        // system, semantic token set (surface/ink/line/focus/etc.), and the
        // "never white text on orange" contrast rule aren't applied yet —
        // existing bg-brand + text-white buttons are untouched for now.
        brand: {
          DEFAULT: "#F47A20", // Cone
          dark: "#24282D", // Asphalt
        },
      },
      fontFamily: {
        // Barlow is the brand guide's body/UI face; it replaces Tailwind's
        // default sans everywhere font-sans (or nothing — body sets it as
        // the default) is in effect.
        sans: ["var(--font-barlow)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Barlow Condensed is the display/headline face — applied to
        // h1/h2/h3 globally in globals.css rather than per-component.
        display: ["var(--font-barlow-condensed)", "ui-sans-serif", "system-ui", "sans-serif"],
        // IBM Plex Mono is the guide's numbers/data face (sets, reps, RPE,
        // rest times) — wired in as Tailwind's `font-mono` so the handful of
        // spots already using it (exercise-id tags, timer countdowns with
        // `tabular-nums`) pick it up for free.
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
