// robots.txt: la web de Reformas Soler se puede indexar; el panel, los
// presupuestos de cada cliente, la contraseña y la API, no.
import type { MetadataRoute } from "next";
import { urlDeLaApp } from "@/lib/telegram";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/solicitar"],
      disallow: ["/panel", "/p/", "/entrar", "/api/"],
    },
    sitemap: `${urlDeLaApp()}/sitemap.xml`,
  };
}
