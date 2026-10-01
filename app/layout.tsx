import type { Metadata } from "next";
import "./globals.css";
import { GlobalRestTimerBar } from "@/components/training/GlobalRestTimerBar";

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
    <html lang="en">
      <body>
        {children}
        <GlobalRestTimerBar />
      </body>
    </html>
  );
}
