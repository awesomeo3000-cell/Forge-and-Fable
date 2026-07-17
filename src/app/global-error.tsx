"use client";

import { useEffect } from "react";

export default function GlobalError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dreamwright global error", props.error);
  }, [props.error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#111417", color: "#f3ead8", fontFamily: "Georgia, serif", padding: 24 }}>
        <main role="alert" style={{ width: "min(520px, 100%)", border: "1px solid #9e8452", padding: 32, background: "#1a1e22" }}>
          <title>Dreamwright — error</title>
          <p style={{ textTransform: "uppercase", letterSpacing: ".14em", color: "#c0a86f" }}>The observatory went dark</p>
          <h1>Dreamwright could not open</h1>
          <p>Retry the application. Your stored data is not changed by this error screen.</p>
          {props.error.digest ? <p><small>Reference: {props.error.digest}</small></p> : null}
          <button type="button" onClick={() => props.unstable_retry()} style={{ padding: "12px 20px", background: "#9e8452", color: "#111417", border: 0, fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
