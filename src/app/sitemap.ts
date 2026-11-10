import type { MetadataRoute } from "next";
import { MARCA } from "@/lib/marca";

// Páginas públicas de mikiosko.com.ar (sumar acá las guías o notas que se agreguen)
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `https://${MARCA.dominio}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
