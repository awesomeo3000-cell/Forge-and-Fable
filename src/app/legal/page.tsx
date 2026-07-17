import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Licensing & Attributions",
  description: `Rules-content licensing and third-party notices for ${BRAND_NAME}.`,
  alternates: { canonical: "/legal" },
};

export default function LicensingPage() {
  return (
    <LegalPage eyebrow="Source & permission" title="Licensing & Attributions">
      <h2>System Reference Document 5.1</h2>
      <p>This work includes material taken from the System Reference Document 5.1 (SRD 5.1) by Wizards of the Coast LLC.</p>
      <p>The source is available through the <a href="https://www.dndbeyond.com/srd" rel="noreferrer">official System Reference Document page</a>. SRD 5.1 is licensed under the <a href="https://creativecommons.org/licenses/by/4.0/legalcode" rel="noreferrer">Creative Commons Attribution 4.0 International License</a>.</p>

      <h2>Additional approved material</h2>
      <p>Any rules or reference material outside SRD 5.1 is included under authorization from its applicable rights holder. That authorization does not transfer ownership of the underlying material to {BRAND_NAME} or to service users.</p>

      <h2>Independent product</h2>
      <p>{BRAND_NAME} is an independent fifth-edition-compatible character and campaign tool. Product names and marks belonging to others remain the property of their respective owners.</p>

      <h2>Software and artwork</h2>
      <p>Original application code, interface design, writing, and commissioned artwork remain subject to their respective ownership and license terms. An account does not grant permission to extract, redistribute, or commercially reuse service assets.</p>
    </LegalPage>
  );
}
