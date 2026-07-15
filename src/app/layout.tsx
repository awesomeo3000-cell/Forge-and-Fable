import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Newsreader,
  Archivo,
  Baloo_2,
  Dancing_Script,
  UnifrakturCook,
  Space_Mono,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
// Arcane Observatory semantic theme layer — must stay after globals.css so
// it wins ties by cascade order (docs/ai-project-proposal-34 §3).
import "./arcane-observatory.css";
// Carded Observatory character-sheet presentation — must stay after
// arcane-observatory.css so its card rules win ties by cascade order.
import "./character-sheet-carded-observatory.css";
import { BRAND_NAME } from "@/lib/brand";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
});
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});
const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  weight: ["400", "500", "700"],
});
const dancing = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  weight: ["400", "700"],
});
const unifraktur = UnifrakturCook({
  subsets: ["latin"],
  variable: "--font-unifraktur",
  weight: ["700"],
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});
// Brand wordmark only (login + splash). The app's display face stays Fraunces.
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "A D&D 5e character builder and DM toolkit.",
};

// viewport-fit=cover lets the mobile shell pad into the safe areas
// (bottom navigation clears the home indicator; AO-11, plan 4F).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${archivo.variable} ${baloo.variable} ${dancing.variable} ${unifraktur.variable} ${spaceMono.variable} ${playfair.variable}`}
    >
      {/* data-theme flips the Arcane Observatory shell (CHANGES-AO-3);
          removing the attribute restores the legacy shell wholesale. */}
      <body data-theme="arcane-observatory">{children}</body>
    </html>
  );
}
