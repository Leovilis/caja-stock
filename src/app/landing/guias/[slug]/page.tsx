import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MARCA } from "@/lib/marca";
import { C } from "../../estilo";
import { GUIAS, guiaPorSlug } from "../contenido";
import { Cta, Marco } from "../Marco";

export const dynamicParams = false;
export const generateStaticParams = () => GUIAS.map((g) => ({ slug: g.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = guiaPorSlug(params.slug);
  if (!g) return {};
  const url = `https://${MARCA.dominio}/guias/${g.slug}`;
  return {
    metadataBase: new URL(`https://${MARCA.dominio}`),
    title: `${g.titulo} | Mostrador`,
    description: g.descripcion,
    alternates: { canonical: `/guias/${g.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title: g.titulo, description: g.descripcion, url, siteName: "Mostrador", locale: "es_AR", type: "article", images: ["/og-mostrador.png"] },
  };
}

const fechaLarga = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export default function Guia({ params }: { params: { slug: string } }) {
  const g = guiaPorSlug(params.slug);
  if (!g) notFound();
  const otras = GUIAS.filter((x) => x.slug !== g.slug);
  const datos = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.titulo,
    description: g.descripcion,
    datePublished: g.fecha,
    dateModified: g.fecha,
    inLanguage: "es-AR",
    image: `https://${MARCA.dominio}/og-mostrador.png`,
    mainEntityOfPage: `https://${MARCA.dominio}/guias/${g.slug}`,
    author: { "@type": "Organization", name: "Mostrador", url: `https://${MARCA.dominio}` },
    publisher: { "@type": "Organization", name: "Mostrador", url: `https://${MARCA.dominio}` },
  };

  return (
    <Marco>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6">
        <a href="/guias" className="mono text-xs font-bold uppercase tracking-widest opacity-60 hover:underline">← Guías</a>
        <h1 className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-tight md:text-5xl">{g.titulo}</h1>
        <p className="mono mt-4 text-xs uppercase tracking-widest opacity-60">
          {fechaLarga(g.fecha)} · {g.lectura} min de lectura
        </p>
        <p className="mt-8 text-xl leading-relaxed">{g.intro}</p>

        {g.secciones.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{s.h}</h2>
            {s.p?.map((t, i) => (
              <p key={i} className="mt-3 text-lg leading-relaxed opacity-90">{t}</p>
            ))}
            {s.lista && (
              <ul className="mt-4 space-y-2 text-lg">
                {s.lista.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full" style={{ background: C.naranja }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.pasos && (
              <ol className="mt-4 space-y-3 text-lg">
                {s.pasos.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: C.cenefa }}>{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

        <Cta texto={g.cierre} />

        <nav className="mt-14">
          <h2 className="mono text-xs font-bold uppercase tracking-widest opacity-60">Otras guías</h2>
          <ul className="mt-3 space-y-2 text-lg">
            {otras.map((o) => (
              <li key={o.slug}>
                <a href={`/guias/${o.slug}`} className="font-semibold underline decoration-2 underline-offset-4">{o.titulo}</a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </Marco>
  );
}
