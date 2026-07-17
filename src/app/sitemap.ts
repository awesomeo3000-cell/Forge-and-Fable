import type { MetadataRoute } from "next";
import { BRAND_URL } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/legal", "/support"].map((path, index) => ({
    url: `${BRAND_URL}${path}`,
    changeFrequency: index === 0 ? "weekly" : "yearly",
    priority: index === 0 ? 1 : 0.4,
  }));
}
