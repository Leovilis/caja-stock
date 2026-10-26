import type { Metadata } from "next";
import localFont from "next/font/local";
import { ArrowRight, MessageCircle, Plus } from "lucide-react";
import { MARCA, linkWhatsApp } from "@/lib/marca";

// Fuentes guardadas en el proyecto (licencia OFL): Bricolage Grotesque y JetBrains Mono
const display = localFont({
  src: [
    { path: "./fuentes/bricolage-grotesque-latin-400-normal.woff2", weight: "400" },
    { path: "./fuentes/bricolage-grotesque-latin-600-normal.woff2", weight: "600" },
    { path: "./fuentes/bricolage-grotesque-latin-800-normal.woff2", weight: "800" },
  ],
  variable: "--f-display",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "./fuentes/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fuentes/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--f-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mostrador — Caja y stock para tu negocio",
  description:
    "Vendé con lector de códigos, cobrá con QR de Mercado Pago, controlá stock y vencimientos y sabé cuánto ganás de verdad. Desde la compu, la tablet o el celular.",
  openGraph: {
    title: "Mostrador — Caja y stock para tu negocio",
    description: "El sistema de caja y stock para kioscos, drugstores y almacenes.",
    url: `https://${MARCA.dominio}`,
    siteName: "Mostrador",
    locale: "es_AR",
    type: "website",
  },
};

const WA_PRUEBA = linkWhatsApp("Hola! Quiero probar Mostrador en mi negocio.");
const WA_CONSULTA = linkWhatsApp("Hola! Tengo una consulta sobre Mostrador.");

/* Paleta: papel, tinta, naranja, amarillo cenefa */
const C = { papel: "#F6F1E7", tinta: "#16130F", naranja: "#FF5B1F", cenefa: "#FFD43B" };

const CENEFAS = [
  { cod: "7790001", t: "Venta con lector", d: "Escaneás, sumás, cobrás. Favoritos, atajos de teclado y artículos sueltos sin código." },
  { cod: "7790002", t: "QR que se confirma solo", d: "Mercado Pago avisa cuando el cliente pagó. La venta se registra sin mirar el celular." },
  { cod: "7790003", t: "Caja por turno", d: "Abrís con fondo, cerrás contando billetes. Sabés al instante si falta o sobra." },
  { cod: "7790004", t: "Stock y vencimientos", d: "Te avisa qué reponer y qué está por vencer antes de que sea pérdida." },
  { cod: "7790005", t: "Precios en un minuto", d: "Aumentá una marca entera con redondeo o importá la lista desde Excel." },
  { cod: "7790006", t: "Cenefas impresas", d: "Imprimís las etiquetas de góndola con el precio nuevo. Como estas." },
  { cod: "7790007", t: "Ganancia real", d: "Cada medio de cobro con su comisión. Los reportes muestran lo que te queda." },
  { cod: "7790008", t: "Proveedores al día", d: "Compras, facturas a pagar, pagos parciales y cuánto le debés a cada uno." },
  { cod: "7790009", t: "Factura ARCA", d: "Factura A, B o C con CAE, sin pagar por comprobante. Plan completo." },
];

const DIA = [
  { h: "08:00", t: "Abrís la caja", d: "Contás el fondo y arrancás. Tus empleados entran con su usuario." },
  { h: "11:40", t: "Te pagan con QR", d: "La pantalla dice «Pago aprobado». Nada de capturas de pantalla." },
  { h: "15:15", t: "Llega el proveedor", d: "Cargás la compra: suma stock, actualiza costos y queda lo que le debés." },
  { h: "18:30", t: "Aviso de vencimiento", d: "Los yogures vencen el jueves. Los ponés adelante o hacés una promo." },
  { h: "22:00", t: "Cerrás y sabés cuánto ganaste", d: "Cierre de caja con conteo y el resultado del día, comisiones incluidas." },
];

const BASICO = ["Punto de venta con lector", "Cobro con QR automático", "Caja, turnos y cierres", "Stock y vencimientos", "Precios masivos y cenefas", "Usuarios para empleados"];
const COMPLETO = ["Todo lo del Básico", "Factura electrónica ARCA", "Proveedores y cta. corriente", "Gastos del negocio", "Reportes y resultado del mes", "Libro de ventas y compras"];

const PREGUNTAS = [
  { p: "¿Tengo que instalar algo?", r: "No. Entrás desde el navegador de la compu, la tablet o el celular, y la podés dejar en la pantalla de inicio como una app." },
  { p: "¿Qué necesito?", r: "Un dispositivo con internet. Lector de códigos e impresora de tickets son opcionales: si ya los tenés, funcionan." },
  { p: "¿Funciona sin internet?", r: "Necesita conexión para registrar las ventas. Así todo queda guardado al instante y lo ves desde donde estés." },
  { p: "¿Cómo conecto Mercado Pago?", r: "Una sola vez, desde Configuración. Después cada cobro con QR sale por el monto exacto y se confirma solo." },
  { p: "¿Mis datos están seguros?", r: "Cada negocio ve sólo lo suyo y cada empleado sólo lo que le habilitás. Las claves de Mercado Pago y ARCA se guardan cifradas." },
  { p: "¿Puedo traer mis productos desde Excel?", r: "Sí. Importás la lista con precios y stock desde una planilla y la exportás cuando quieras." },
];

/** borde de ticket cortado (dientes) */
function Dientes({ arriba = false }: { arriba?: boolean }) {
  const dir = arriba ? "to top" : "to bottom";
  return (
    <div
      aria-hidden
      className="h-3 w-full"
      style={{
        background: `linear-gradient(${dir} right, #fff 50%, transparent 50%) 0 0 / 14px 100% repeat-x, linear-gradient(${dir} left, #fff 50%, transparent 50%) 7px 0 / 14px 100% repeat-x`,
      }}
    />
  );
}

function CodigoBarras({ className = "" }: { className?: string }) {
  const barras = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 1, 2, 2];
  return (
    <div className={`flex h-10 items-stretch ${className}`} aria-hidden>
      {barras.map((w, i) => (
        <span key={i} style={{ width: w * 2, background: i % 2 ? "transparent" : "currentColor" }} />
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div className={`${display.variable} ${mono.variable} min-h-screen overflow-x-hidden`} style={{ background: C.papel, color: C.tinta, fontFamily: "var(--f-display)" }}>
      <style>{`
        @keyframes cinta { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .cinta { animation: cinta 30s linear infinite }
        @media (prefers-reduced-motion: reduce) { .cinta { animation: none } }
        .mono { font-family: var(--f-mono), ui-monospace, monospace }
        .puntos { flex: 1; border-bottom: 2px dotted currentColor; opacity: .35; margin: 0 .5rem .35rem }
      `}</style>

      {/* Barra */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <a href="#" className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold tracking-tight">mostrador</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.naranja }} />
        </a>
        <nav className="mono hidden items-center gap-7 text-xs uppercase tracking-widest md:flex">
          <a href="#gondola" className="hover:underline">Funciones</a>
          <a href="#dia" className="hover:underline">Un día</a>
          <a href="#planes" className="hover:underline">Planes</a>
          <a href="#preguntas" className="hover:underline">Preguntas</a>
        </nav>
        <a href={`${MARCA.urlApp}/login`} className="mono rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition hover:bg-black hover:text-white" style={{ borderColor: C.tinta }}>
          Ingresar
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-6 md:pt-12 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="mono mb-6 inline-block -rotate-1 px-2 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: C.cenefa }}>
            Caja y stock para tu negocio
          </p>
          <h1 className="text-[2.7rem] font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Todo tu negocio,
            <br />
            <span className="relative inline-block">
              de este lado
              <svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 w-full" aria-hidden preserveAspectRatio="none">
                <path d="M2 14 Q 75 2 150 10 T 298 6" fill="none" stroke={C.naranja} strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>
            <br />
            del mostrador.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed opacity-80">
            Vendés con el lector, cobrás con QR de Mercado Pago que se confirma solo, controlás stock y vencimientos, y a la noche sabés cuánto ganaste de
            verdad.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a href={WA_PRUEBA} className="group inline-flex items-center gap-3 rounded-full py-3 pl-7 pr-3 text-lg font-semibold text-white" style={{ background: C.tinta }}>
              Probalo gratis
              <span className="flex h-9 w-9 items-center justify-center rounded-full transition group-hover:translate-x-1" style={{ background: C.naranja }}>
                <ArrowRight size={18} />
              </span>
            </a>
            <a href="#gondola" className="mono text-sm font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">
              Ver qué hace
            </a>
          </div>
        </div>

        {/* Ticket */}
        <div className="mx-auto w-full max-w-[340px] rotate-2 drop-shadow-[0_18px_30px_rgba(22,19,15,0.18)]">
          <Dientes arriba />
          <div className="mono bg-white px-6 py-5 text-[13px]">
            <div className="text-center">
              <div className="text-base font-bold">MOSTRADOR</div>
              <div className="opacity-60">caja y stock · {MARCA.dominio}</div>
              <div className="mt-1 opacity-60">TICKET 0001-00000128</div>
            </div>
            <div className="my-3 border-t-2 border-dashed border-black/30" />
            {[
              ["Venta con lector", "SÍ"],
              ["Cobro con QR MP", "SÍ"],
              ["Stock y vencim.", "SÍ"],
              ["Precios masivos", "SÍ"],
              ["Cierre de caja", "SÍ"],
              ["Capturas truchas", "NO"],
            ].map(([a, b]) => (
              <div key={a} className="flex items-end py-0.5">
                <span>{a}</span>
                <span className="puntos" />
                <span className="font-bold" style={{ color: b === "NO" ? C.naranja : undefined }}>
                  {b}
                </span>
              </div>
            ))}
            <div className="my-3 border-t-2 border-dashed border-black/30" />
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>TU TIEMPO</span>
            </div>
            <div className="mt-1 flex justify-between opacity-60">
              <span>Pago</span>
              <span>QR · aprobado ✓</span>
            </div>
            <CodigoBarras className="mt-4 justify-center" />
            <div className="mt-1 text-center text-[11px] opacity-60">¡GRACIAS POR SU COMPRA!</div>
          </div>
          <Dientes />
        </div>
      </section>

      {/* Cinta */}
      <div className="-mx-4 -rotate-1 overflow-hidden border-y-2 py-3" style={{ background: C.cenefa, borderColor: C.tinta }}>
        <div className="cinta mono flex w-max whitespace-nowrap text-sm font-bold uppercase tracking-widest">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k} className="flex" aria-hidden={k === 1}>
              {["Kioscos", "Drugstores", "Almacenes", "Maxikioscos", "Dietéticas", "Librerías", "Despensas", "Minimercados"].map((x) => (
                <span key={x} className="px-6">
                  {x} <span style={{ color: C.naranja }}>✱</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Góndola de funciones (cenefas) */}
      <section id="gondola" className="mx-auto max-w-6xl scroll-mt-10 px-5 py-20">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-xl text-4xl font-extrabold leading-none tracking-tight md:text-5xl">Todo lo que trae, a la vista como en la góndola.</h2>
          <p className="mono max-w-xs text-sm opacity-70">Precio de cada función: incluida. Así de simple.</p>
        </div>
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {CENEFAS.map((c, i) => (
            <div key={c.t}>
              <div className="flex min-h-[170px] flex-col justify-between border-l-[10px] p-4 shadow-[4px_4px_0_0_rgba(22,19,15,1)]" style={{ background: C.cenefa, borderColor: C.tinta }}>
                <div>
                  <div className="mono flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-70">
                    <span>{String(i + 1).padStart(2, "0")} · Función</span>
                    <span>{c.cod}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-extrabold leading-tight">{c.t}</h3>
                  <p className="mt-1.5 text-sm leading-snug opacity-80">{c.d}</p>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <CodigoBarras className="h-6 opacity-80" />
                  <span className="mono text-xs font-bold uppercase">incluida</span>
                </div>
              </div>
              {/* riel de la góndola */}
              <div className="h-2" style={{ background: "repeating-linear-gradient(90deg,#bdb6a8 0 2px,#d8d1c3 2px 8px)" }} aria-hidden />
            </div>
          ))}
        </div>
      </section>

      {/* Un día en el mostrador */}
      <section id="dia" className="scroll-mt-10" style={{ background: C.tinta, color: C.papel }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="mono mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: C.naranja }}>
              Un día cualquiera
            </p>
            <h2 className="text-4xl font-extrabold leading-none tracking-tight md:text-5xl">Así se ve un día con Mostrador.</h2>
            <p className="mt-5 max-w-sm opacity-70">De la apertura al cierre, sin cuadernos ni cuentas a mano.</p>
          </div>
          <ol className="relative border-l-2 border-dashed" style={{ borderColor: "rgba(246,241,231,0.25)" }}>
            {DIA.map((d) => (
              <li key={d.h} className="relative pb-10 pl-8 last:pb-0">
                <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2" style={{ background: C.naranja, borderColor: C.tinta }} />
                <div className="mono text-sm font-bold" style={{ color: C.cenefa }}>
                  {d.h}
                </div>
                <h3 className="mt-1 text-2xl font-extrabold">{d.t}</h3>
                <p className="mt-1 max-w-md opacity-70">{d.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planes como tickets */}
      <section id="planes" className="mx-auto max-w-5xl scroll-mt-10 px-5 py-20">
        <h2 className="mb-3 text-center text-4xl font-extrabold tracking-tight md:text-5xl">Elegí tu ticket.</h2>
        <p className="mx-auto mb-12 max-w-md text-center opacity-70">Empezás con una prueba gratis. Si crecés, pasás al completo sin perder nada.</p>
        <div className="grid items-start gap-10 md:grid-cols-2">
          {[
            { n: "Básico", s: "Para vender y controlar caja y stock", items: BASICO, dest: false },
            { n: "Completo", s: "Todo el negocio, con factura electrónica", items: COMPLETO, dest: true },
          ].map((p, i) => (
            <div key={p.n} className={`drop-shadow-[0_14px_24px_rgba(22,19,15,0.12)] ${i ? "md:rotate-1" : "md:-rotate-1"}`}>
              <Dientes arriba />
              <div className="bg-white px-7 py-6">
                <div className="mono flex justify-between text-xs uppercase tracking-widest opacity-60">
                  <span>Plan</span>
                  <span>N° 000{i + 1}</span>
                </div>
                <h3 className="mt-1 flex flex-wrap items-center gap-3 text-4xl font-extrabold">
                  {p.n}
                  {p.dest && (
                    <span className="mono rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: C.naranja }}>
                      recomendado
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-sm opacity-70">{p.s}</p>
                <div className="my-4 border-t-2 border-dashed border-black/20" />
                <ul className="mono space-y-1.5 text-[13px]">
                  {p.items.map((x) => (
                    <li key={x} className="flex items-end">
                      <span>{x}</span>
                      <span className="puntos" />
                      <span className="font-bold">✓</span>
                    </li>
                  ))}
                </ul>
                <div className="my-4 border-t-2 border-dashed border-black/20" />
                <a
                  href={linkWhatsApp(`Hola! Me interesa el plan ${p.n} de Mostrador.`)}
                  className="flex items-center justify-between rounded-full px-5 py-3 font-semibold"
                  style={p.dest ? { background: C.tinta, color: "#fff" } : { border: `2px solid ${C.tinta}` }}
                >
                  Consultar precio <ArrowRight size={18} />
                </a>
              </div>
              <Dientes />
            </div>
          ))}
        </div>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-10 px-5 pb-20">
        <h2 className="mb-8 text-4xl font-extrabold tracking-tight md:text-5xl">Preguntas de mostrador.</h2>
        <div className="border-t-2" style={{ borderColor: C.tinta }}>
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group border-b-2 py-5" style={{ borderColor: C.tinta }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {p}
                <Plus size={22} className="shrink-0 transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-2xl opacity-75">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="px-5 pb-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] px-6 py-16 text-center md:py-20" style={{ background: C.naranja, color: C.tinta }}>
          <p className="mono text-xs font-bold uppercase tracking-widest">Cartel de la puerta</p>
          <h2 className="mt-3 text-6xl font-extrabold tracking-tight md:text-8xl">ABIERTO</h2>
          <p className="mx-auto mt-4 max-w-md text-lg">Escribinos y en el día te dejamos la cuenta lista para empezar a vender.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={WA_PRUEBA} className="inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-white" style={{ background: C.tinta }}>
              <MessageCircle size={18} /> Escribinos por WhatsApp
            </a>
            <a href={`${MARCA.urlApp}/login`} className="rounded-full border-2 px-7 py-4 font-semibold" style={{ borderColor: C.tinta }}>
              Ya tengo cuenta
            </a>
          </div>
        </div>
      </section>

      <footer className="mono mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs uppercase tracking-widest opacity-70">
        <span>mostrador · {MARCA.dominio}</span>
        <span className="flex gap-5">
          <a href={WA_CONSULTA} className="hover:underline">
            Contacto
          </a>
          <a href={`${MARCA.urlApp}/login`} className="hover:underline">
            Ingresar
          </a>
        </span>
      </footer>
    </div>
  );
}
