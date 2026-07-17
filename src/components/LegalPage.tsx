import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/brand";

export default function LegalPage(props: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <article>
        <span className="legal-eyebrow">{props.eyebrow}</span>
        <h1>{props.title}</h1>
        <p className="legal-updated">Effective July 17, 2026</p>
        {props.children}
        <nav className="legal-nav" aria-label="Legal and support">
          <Link href="/">Return to {BRAND_NAME}</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/legal">Licensing</Link>
          <Link href="/support">Support</Link>
        </nav>
      </article>
    </main>
  );
}
