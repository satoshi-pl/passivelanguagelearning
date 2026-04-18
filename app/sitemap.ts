import type { MetadataRoute } from "next";

const SITE_URL = "https://passivelanguagelearning.io";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/signup`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/confirm-signup`,
      changeFrequency: "weekly",
      priority: 0.35,
    },
    {
      url: `${SITE_URL}/faq`,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/decks`,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
