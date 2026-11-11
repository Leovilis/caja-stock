import type { MetadataRoute } from "next";
import { MARCA } from "@/lib/marca";
import { GUIAS } from "./landing/guias/contenido";

// Páginas públicas de mikiosko.com.ar (las guías se suman solas desde contenido.ts)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${MARCA.dominio}`;
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/guias`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...GUIAS.map((g) => ({ url: `${base}/guias/${g.slug}`, lastModified: new Date(`${g.fecha}T12:00:00`), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
