import type { Metadata } from "next";
import { MARCA } from "@/lib/marca";
import { C } from "../estilo";
import { GUIAS } from "./contenido";
import { Marco } from "./Marco";

const TITULO = "Guías para kioscos y almacenes | Mostrador";
const DESCRIPCION = "Guías prácticas para tu kiosco, drugstore o almacén: cierre de caja, cobro con QR de Mercado Pago, control de stock y ganancia real.";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${MARCA.dominio}`),
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/guias" },
  robots: { index: true, follow: true },
  openGraph: { title: TITULO, description: DESCRIPCION, url: `https://${MARCA.dominio}/guias`, siteName: "Mostrador", locale: "es_AR", type: "website", images: ["/og-mostrador.png"] },
};

export default function Guias() {
  return (
    <Marco>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        <p className="mono mb-4 inline-block -rotate-1 px-2 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: C.cenefa }}>
          Guías
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-none tracking-tight md:text-6xl">Para que tu kiosco funcione mejor.</h1>
        <p className="mt-5 max-w-2xl text-lg opacity-80">Notas cortas y prácticas sobre caja, cobros, stock y números del negocio. Sirven sin importar qué sistema uses.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {GUIAS.map((g) => (
            <a key={g.slug} href={`/guias/${g.slug}`} className="group rounded-[1.25rem] border-2 bg-white p-6 transition hover:-translate-y-1" style={{ borderColor: C.tinta }}>
              <span className="mono text-xs font-bold uppercase tracking-widest opacity-60">{g.lectura} min de lectura</span>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight group-hover:underline">{g.titulo}</h2>
              <p className="mt-2 opacity-75">{g.resumen}</p>
            </a>
          ))}
        </div>
      </main>
    </Marco>
  );
}
