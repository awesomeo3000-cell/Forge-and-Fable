import type { Metadata } from "next";
import {
  Fraunces,
  Newsreader,
  Archivo,
  Baloo_2,
  Dancing_Script,
  UnifrakturCook,
  Space_Mono,
} from "next/font/google";
import "./globals.css";
// Arcane Observatory semantic theme layer — must stay after globals.css so
// it wins ties by cascade order (docs/ai-project-proposal-34 §3).
import "./arcane-observatory.css";

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

export const metadata: Metadata = {
  title: "Forge & Fable",
  description: "A hand-bound D&D 5e character builder and play console.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${archivo.variable} ${baloo.variable} ${dancing.variable} ${unifraktur.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
