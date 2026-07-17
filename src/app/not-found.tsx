import Link from "next/link";

export default function NotFound() {
  return (
    <main className="entry-screen ao-title-entry">
      <section className="ao-modal" style={{ padding: "2rem", maxWidth: 520 }}>
        <span className="ao-title-eyebrow">Nothing is written here</span>
        <h1>Page not found</h1>
        <p>The requested page does not exist or is not available in this deployment.</p>
        <Link className="ao-btn ao-btn-brass" href="/">Return to Dreamwright</Link>
      </section>
    </main>
  );
}
