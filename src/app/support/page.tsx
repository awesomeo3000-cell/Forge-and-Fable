import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Support",
  description: `Account, security, privacy, and technical support for ${BRAND_NAME}.`,
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <LegalPage eyebrow="Help at the table" title="Support">
      <p>For account access, privacy requests, suspected security issues, data-loss concerns, or technical problems, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>What to include</h2>
      <ul>
        <li>The email address associated with the account, when the issue concerns account access.</li>
        <li>What you were doing, what you expected, and what happened instead.</li>
        <li>The page, character, or campaign involved and the approximate time of the problem.</li>
        <li>An error reference from the application, if one appeared.</li>
      </ul>
      <p>Do not email passwords, verification tokens, reset links, session cookies, API keys, or private campaign material that is not needed to diagnose the issue.</p>

      <h2>Self-service controls</h2>
      <p>Use <strong>Forgot password?</strong> on the login screen to request a reset link. Once signed in, use <strong>My data</strong> to export your records or delete the account.</p>
    </LegalPage>
  );
}
