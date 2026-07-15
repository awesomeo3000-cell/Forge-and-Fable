import type { CampaignThemeId } from "@/types/campaign";

export type { CampaignThemeId } from "@/types/campaign";

export type CampaignTheme = {
  id: CampaignThemeId;
  label: string;
  description: string;
  imageUrl: string;
};

export const DEFAULT_CAMPAIGN_THEME_ID: CampaignThemeId = "forge";

export const CAMPAIGN_THEMES: CampaignTheme[] = [
  {
    id: "forge",
    label: "The Arcane Forge",
    description: "Bronze, fire and dangerous old magic.",
    imageUrl: "/forge-backdrop.png",
  },
  {
    id: "observatory",
    label: "The Observatory",
    description: "Moonlit towers, maps and quiet discoveries.",
    imageUrl: "/observatory-backdrop.jpg",
  },
  {
    id: "wilds",
    label: "The Open Wilds",
    description: "High passes, green valleys and a long road ahead.",
    imageUrl: "/heroes-backdrop.jpg",
  },
];

export function isCampaignThemeId(value: unknown): value is CampaignThemeId {
  return CAMPAIGN_THEMES.some((theme) => theme.id === value);
}

export function getCampaignTheme(value: unknown): CampaignTheme {
  return CAMPAIGN_THEMES.find((theme) => theme.id === value) ?? CAMPAIGN_THEMES[0];
}
