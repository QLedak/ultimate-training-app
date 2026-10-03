import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { GlobalRestTimerBar } from "@/components/training/GlobalRestTimerBar";

// True Ultimate Training brand guide v1 (Oct 2026), §5 Typography: Barlow
// (body/UI), Barlow Condensed (display/headlines), IBM Plex Mono (data —
// sets/reps/loads/RPE). Loaded here via next/font so every page gets them
// without a per-component change; see tailwind.config.ts for how each is
// wired to a Tailwind font family, and globals.css for where they're applied.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ultimate Training",
  description: "AI-built strength & conditioning programs for ultimate frisbee players.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // "dark" is hardcoded on, not conditional — there's no light/dark toggle
    // yet, this just makes dark the app's permanent default (brand kit's
    // Asphalt background). See tailwind.config.ts / globals.css for how the
    // rest of the app's colors respond to it.
    <html
      lang="en"
      className={`dark ${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}
    >
      <body>
        {children}
        <GlobalRestTimerBar />
      </body>
    </html>
  );
}
