import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { MARCA } from "@/lib/marca";

/**
 * robots.txt según el dominio:
 *  - mikiosko.com.ar  → se indexa la página de presentación
 *  - app.mikiosko.com.ar (y *.vercel.app) → no se indexa nada (es la aplicación, con login)
 */
export default function robots(): MetadataRoute.Robots {
  const host = (headers().get("host") ?? "").toLowerCase().split(":")[0];
  const esLanding = host === MARCA.dominio || host === `www.${MARCA.dominio}`;
  if (!esLanding) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `https://${MARCA.dominio}/sitemap.xml`,
    host: `https://${MARCA.dominio}`,
  };
}
