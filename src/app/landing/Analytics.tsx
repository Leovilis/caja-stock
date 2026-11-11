import Script from "next/script";

/**
 * Google Analytics / Tag Manager, sólo en la página de presentación y las guías (no en la app).
 * Se activa cargando NEXT_PUBLIC_GA_ID en Vercel → Settings → Environment Variables con:
 *   - un ID de Google Analytics 4:  G-XXXXXXXXXX
 *   - o un contenedor de Tag Manager: GTM-XXXXXXX
 */
export function Analytics() {
  const id = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
  const ga4 = /^G-[A-Z0-9]+$/.test(id);
  const gtm = /^GTM-[A-Z0-9]+$/.test(id);
  if (!ga4 && !gtm) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/${gtm ? "gtm.js" : "gtag/js"}?id=${id}`} strategy="afterInteractive" />
      <Script id="etiqueta-google" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${ga4 ? `gtag('config','${id}');` : ""}`}
      </Script>
    </>
  );
}
