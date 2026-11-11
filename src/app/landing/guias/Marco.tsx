import type { ReactNode } from "react";
import { MARCA } from "@/lib/marca";
import { C, display, mono } from "../estilo";
import { Analytics } from "../Analytics";

/** Encabezado y pie de las guías, con el estilo de la página de presentación */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${mono.variable} min-h-screen`} style={{ background: C.papel, color: C.tinta, fontFamily: "var(--f-display)" }}>
      <Analytics />
      <style>{`.mono { font-family: var(--f-mono), ui-monospace, monospace }`}</style>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <a href="/" className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold tracking-tight">mostrador</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.naranja }} />
        </a>
        <nav className="mono flex items-center gap-5 text-xs font-bold uppercase tracking-widest">
          <a href="/guias" className="hover:underline">Guías</a>
          <a href="/#probar" className="whitespace-nowrap rounded-full px-4 py-1.5 text-white" style={{ background: C.tinta }}>
            Probalo gratis
          </a>
        </nav>
      </header>
      {children}
      <footer className="mono mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs uppercase tracking-widest opacity-70">
        <span>mostrador · {MARCA.dominio}</span>
        <span className="flex gap-5">
          <a href="/" className="hover:underline">Inicio</a>
          <a href="/guias" className="hover:underline">Guías</a>
          <a href={`${MARCA.urlApp}/login`} className="hover:underline">Ingresar</a>
        </span>
      </footer>
    </div>
  );
}

/** Llamado a la acción al final de cada guía */
export function Cta({ texto }: { texto: string }) {
  return (
    <aside className="mt-12 rounded-[1.5rem] p-7 md:p-9" style={{ background: C.naranja }}>
      <p className="mono mb-3 inline-block -rotate-1 px-2 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: C.cenefa }}>
        Con Mostrador
      </p>
      <p className="text-lg leading-relaxed">{texto}</p>
      <a href="/#probar" className="mt-6 inline-block rounded-full px-6 py-3 font-semibold text-white" style={{ background: C.tinta }}>
        Probalo gratis en tu negocio →
      </a>
    </aside>
  );
}
