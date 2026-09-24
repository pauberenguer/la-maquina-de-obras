// sitemap.xml: solo las dos páginas públicas que tiene sentido encontrar.
import type { MetadataRoute } from "next";
import { urlDeLaApp } from "@/lib/telegram";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlDeLaApp();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/solicitar`, changeFrequency: "yearly", priority: 0.8 },
  ];
}
