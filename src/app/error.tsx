"use client";

import { useEffect } from "react";

export default function AppError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dreamwright route error", props.error);
  }, [props.error]);

  return (
    <main className="entry-screen ao-title-entry">
      <section className="ao-modal" role="alert" style={{ padding: "2rem", maxWidth: 520 }}>
        <span className="ao-title-eyebrow">The page lost its place</span>
        <h1>Something went wrong</h1>
        <p>Your saved characters are still in the vault. Retry the page; if the problem continues, include the reference below with your feedback.</p>
        {props.error.digest ? <p><small>Reference: {props.error.digest}</small></p> : null}
        <button type="button" className="ao-btn ao-btn-brass" onClick={() => props.unstable_retry()}>Try again</button>
      </section>
    </main>
  );
}
