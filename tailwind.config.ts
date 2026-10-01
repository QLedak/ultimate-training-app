import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// True Ultimate Training brand colours and fonts.
// See the brand guide: cone orange + asphalt/chalk greys; Barlow, Barlow Condensed, IBM Plex Mono.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F47A20", // cone: fills only (buttons, progress, highlights)
          hover: "#FF8A33", // cone hover
          on: "#16181B", // text on cone fills (never white on orange)
          text: "#A84A0C", // orange for text and links on light backgrounds
          tint: "#FDEBDC", // light orange highlight (selected cards, hovers)
          tint2: "#FBDCC2", // stronger tint for hover on tinted cards
          dark: "#24282D", // asphalt: headings, dark bars
        },
        // Brand greys replace Tailwind's slate, at matching contrast levels,
        // so every existing slate-* class picks up the brand palette.
        slate: {
          50: "#F5F3EF", // chalk
          100: "#EDEAE4",
          200: "#DDD9D2",
          300: "#C6C8CB",
          400: "#959CA3",
          500: "#666E76",
          600: "#4D545B",
          700: "#3A4047",
          800: "#24282D", // asphalt
          900: "#16181B", // ink
          950: "#0F1113",
        },
      },
      fontFamily: {
        sans: ["var(--font-barlow)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-barlow-condensed)", "Arial Narrow", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-plex-mono)", ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [],
};

export default config;
