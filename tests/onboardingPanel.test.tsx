import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OnboardingPanel from "@/components/OnboardingPanel";

describe("OnboardingPanel", () => {
  it("renders both onboarding choices without a runtime reference error", () => {
    const html = renderToStaticMarkup(
      <OnboardingPanel onStartBuilding={() => {}} onRunCampaign={async () => true} />,
    );
    expect(html).toContain("Create a character");
    expect(html).toContain("Run a campaign");
  });
});
