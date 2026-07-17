import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `Terms governing use of ${BRAND_NAME}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="The table agreement" title="Terms of Use">
      <p>These terms govern access to {BRAND_NAME}. By creating an account or using the service, you agree to them.</p>

      <h2>Your account</h2>
      <p>Provide accurate account information, safeguard your password, and use only accounts you are authorized to control. You are responsible for activity performed through your account. If you are not legally able to accept these terms, use the service only with authorization from a parent or legal guardian.</p>

      <h2>Acceptable use</h2>
      <p>Do not use the service to break the law, harass others, distribute malware, probe or bypass security controls, overload the service, impersonate another person, or upload material you do not have permission to use. Campaign participants remain responsible for the content they share with their table.</p>

      <h2>Your content</h2>
      <p>You keep your rights in original characters, notes, campaign material, and uploads. You grant {BRAND_NAME} the limited permission needed to store, process, back up, display, and transmit that material solely to operate and secure the service.</p>

      <h2>Availability and changes</h2>
      <p>The service may change, pause, or discontinue features and may restrict accounts that threaten users, infrastructure, or legal compliance. We aim to preserve user records and provide export controls, but uninterrupted availability and permanent storage are not guaranteed.</p>

      <h2>Game rules and decisions</h2>
      <p>{BRAND_NAME} is a play aid. Rules calculations, imported data, and generated suggestions may contain errors. The game master and players remain responsible for table rulings and for reviewing exported or imported material.</p>

      <h2>Disclaimers and responsibility</h2>
      <p>The service is provided as available without warranties that it will be uninterrupted or error-free. To the maximum extent permitted by applicable law, {BRAND_NAME} is not responsible for indirect, incidental, or consequential loss arising from use of the service.</p>

      <h2>Questions</h2>
      <p>Questions, security reports, or account concerns may be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
