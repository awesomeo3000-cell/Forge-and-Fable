import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${BRAND_NAME} collects, uses, protects, exports, and deletes account data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Your records" title="Privacy Policy">
      <p>{BRAND_NAME} collects only the information needed to operate the character builder, campaign tools, account security, and support workflow.</p>

      <h2>Information we store</h2>
      <ul>
        <li>Account name, email address, password hash, verification state, and security/session records.</li>
        <li>Characters, campaigns, rolls, notes, encounters, journals, settings, and other records you choose to create.</li>
        <li>Portraits, audio, PDFs, and other files you choose to upload or import.</li>
        <li>Feedback and support information you submit.</li>
        <li>Operational information needed for rate limiting, error diagnosis, backups, and service security.</li>
      </ul>

      <h2>How information is used</h2>
      <p>We use this information to provide and secure the service, save and synchronize your game records, send transactional account email, answer support requests, prevent abuse, diagnose failures, and recover from data loss. We do not sell personal information or use it for third-party behavioral advertising.</p>

      <h2>Service providers</h2>
      <p>Hosting infrastructure processes application data on our behalf. Resend processes transactional account email. Providers receive only the information required for their role and operate under their own security and privacy commitments.</p>

      <h2>Cookies and local storage</h2>
      <p>An HTTP-only session cookie keeps you signed in. Browser local storage remembers display preferences, workspace state, and non-secret convenience settings. The service does not rely on cross-site advertising cookies.</p>

      <h2>Retention and control</h2>
      <p>Account records remain until you delete the account or they are removed for security, legal, or operational reasons. Temporary import artifacts expire on an operational schedule. Limited encrypted backups may retain deleted records until their normal rotation completes.</p>
      <p>While signed in, use <strong>My data</strong> to download a JSON copy of your records or permanently delete your account. You may also contact us for access, correction, deletion, or privacy questions.</p>

      <h2>Security and contact</h2>
      <p>Passwords are stored as one-way hashes, sessions use secure cookies in production, and access is limited by authentication and role checks. No system is risk-free; report suspected account or privacy issues to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
