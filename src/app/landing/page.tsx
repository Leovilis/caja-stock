import type { Metadata } from "next";
import {
  BadgeDollarSign,
  BarChart3,
  Barcode,
  CalendarClock,
  Check,
  ChevronDown,
  FileCheck2,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { MARCA, linkWhatsApp } from "@/lib/marca";

export const metadata: Metadata = {
  title: "Mostrador — Caja y stock para tu negocio",
  description:
    "Vendé con lector de códigos, cobrá con QR de Mercado Pago, controlá stock y vencimientos y sabé cuánto ganás de verdad. Sin instalar nada: funciona en la compu, la tablet o el celular.",
  openGraph: {
    title: "Mostrador — Caja y stock para tu negocio",
    description: "El sistema de caja y stock para kioscos y drugstores. Cobrá con QR, controlá la caja y sabé cuánto ganás.",
    url: `https://${MARCA.dominio}`,
    siteName: "Mostrador",
    locale: "es_AR",
    type: "website",
  },
};

const WA_PRUEBA = linkWhatsApp("Hola! Quiero probar Mostrador en mi negocio.");
const WA_CONSULTA = linkWhatsApp("Hola! Tengo una consulta sobre Mostrador.");

const FUNCIONES = [
  {
    icon: Barcode,
    titulo: "Vendé en segundos",
    texto: "Escaneás con el lector, buscás por nombre o tocás tus favoritos. Atajos de teclado, ítems sueltos sin código y ticket impreso.",
  },
  {
    icon: QrCode,
    titulo: "QR de Mercado Pago que se confirma solo",
    texto: "La caja genera el cobro por el monto exacto y la venta se registra sola cuando el cliente paga. Chau capturas truchas.",
  },
  {
    icon: Wallet,
    titulo: "Caja en orden en cada turno",
    texto: "Apertura con fondo, retiros e ingresos, cierre con conteo de billetes. Sabés al instante si falta o sobra plata.",
  },
  {
    icon: CalendarClock,
    titulo: "Stock y vencimientos",
    texto: "Avisos de lo que hay que reponer y de lo que está por vencer. Ajustes por rotura o vencido que quedan registrados.",
  },
  {
    icon: Tags,
    titulo: "Precios en un minuto",
    texto: "Subí todo Coca-Cola un 10 % con redondeo, o cambiá precios desde Excel. Imprimís las cenefas nuevas para la góndola.",
  },
  {
    icon: BadgeDollarSign,
    titulo: "Ganancia real",
    texto: "Cada medio de cobro con su comisión: QR, débito, crédito. Los reportes te muestran lo que te queda de verdad.",
  },
  {
    icon: Truck,
    titulo: "Proveedores y cuenta corriente",
    texto: "Compras que suman stock y actualizan costos. Facturas a pagar, pagos parciales y lo que le debés a cada uno.",
  },
  {
    icon: FileCheck2,
    titulo: "Factura electrónica ARCA",
    texto: "Factura A, B o C y notas de crédito a pedido, con CAE y QR. Sin pagar por comprobante.",
  },
  {
    icon: Users,
    titulo: "Empleados con permisos",
    texto: "Cada vendedor con su usuario: vende y cierra caja, pero no ve costos ni cambia precios. Vos ves todo.",
  },
];

const BASICO = ["Punto de venta con lector de códigos", "Cobro con QR de Mercado Pago automático", "Caja, turnos y cierres", "Productos, stock y vencimientos", "Precios masivos y cenefas", "Usuarios para tus empleados"];
const COMPLETO = ["Todo lo del plan Básico", "Factura electrónica ARCA (A, B y C)", "Compras y proveedores con cuenta corriente", "Gastos del negocio", "Reportes de ganancia y resultado del mes", "Libro de ventas y compras con / sin factura"];

const PREGUNTAS = [
  { p: "¿Tengo que instalar algo?", r: "No. Entrás desde el navegador de la compu, la tablet o el celular. También la podés agregar a la pantalla de inicio como si fuera una app." },
  { p: "¿Qué necesito para usarlo?", r: "Una compu, tablet o celular con internet. El lector de códigos de barras y la impresora de tickets son opcionales: si ya los tenés, funcionan." },
  { p: "¿Funciona sin internet?", r: "Necesita conexión para registrar las ventas, así todo queda guardado al instante y lo podés ver desde cualquier lugar." },
  { p: "¿Cómo funciona el cobro con QR?", r: "Conectás tu cuenta de Mercado Pago una sola vez. Al cobrar, la caja genera el QR por el monto exacto; cuando el cliente paga, la venta se confirma sola y queda registrado si fue con dinero en cuenta, débito o crédito." },
  { p: "¿Mis datos están seguros?", r: "Cada negocio ve sólo lo suyo y tus empleados ven sólo lo que les habilitás. Las claves de Mercado Pago y ARCA se guardan cifradas." },
  { p: "¿Puedo cargar mis productos desde Excel?", r: "Sí. Importás tu lista de productos con precios y stock desde una planilla, y después la podés exportar cuando quieras." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Barra */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="#" className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="rounded-lg bg-brand-600 p-1.5 text-white">
              <Store size={20} />
            </span>
            <span>
              Mostrador
              <span className="ml-1.5 hidden text-xs font-medium text-slate-500 sm:inline">caja y stock para tu negocio</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-brand-600">
              Funciones
            </a>
            <a href="#qr" className="hover:text-brand-600">
              Cobro con QR
            </a>
            <a href="#planes" className="hover:text-brand-600">
              Planes
            </a>
            <a href="#preguntas" className="hover:text-brand-600">
              Preguntas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={`${MARCA.urlApp}/login`} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Ingresar
            </a>
            <a href={WA_PRUEBA} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Probalo gratis
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-600">Para kioscos, drugstores y almacenes</p>
            <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
              Vendé rápido, cobrá con QR y sabé <span className="text-brand-600">cuánto ganás de verdad.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Mostrador es la caja de tu negocio: lector de códigos, stock y vencimientos, cobros con Mercado Pago que se confirman solos y reportes que
              descuentan las comisiones. Todo desde la compu del mostrador o desde tu celular.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={WA_PRUEBA} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700">
                <MessageCircle size={18} /> Quiero probarlo
              </a>
              <a href="#funciones" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50">
                Ver qué hace
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              {["Sin instalar nada", "Compu, tablet o celular", "Hecho en Argentina"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={16} className="text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Maqueta de la caja */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-brand-100/60 blur-2xl" aria-hidden />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-2.5 text-sm text-white">
                <span className="flex items-center gap-2 font-semibold">
                  <Store size={16} /> Kiosco La Esquina
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Caja abierta</span>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_190px]">
                <div>
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-500 px-3 py-2 text-sm text-slate-400">
                    <Barcode size={16} /> Escaneá o buscá un producto…
                  </div>
                  {[
                    ["Gaseosa cola 500 ml", 2, 1800],
                    ["Alfajor triple", 1, 1500],
                    ["Papas fritas 80 g", 1, 2200],
                    ["Agua mineral 1,5 L", 1, 1600],
                  ].map(([n, c, p]) => (
                    <div key={n as string} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                      <span>
                        <span className="mr-2 inline-block w-5 rounded bg-slate-100 text-center text-xs">{c}</span>
                        {n}
                      </span>
                      <span className="font-semibold tabular-nums">$ {((c as number) * (p as number)).toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <div className="text-xs uppercase text-slate-500">Total</div>
                    <div className="text-3xl font-extrabold tabular-nums text-slate-900">$ 8.900</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-2 py-2 text-xs font-semibold text-white">
                      <QrCode size={14} /> Cobrar con QR
                    </div>
                    <div className="rounded-lg bg-emerald-600 px-2 py-2 text-center text-xs font-semibold text-white">Efectivo</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
                <Check size={14} /> Pago con QR aprobado · Venta #128 registrada
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">Todo lo que tu negocio necesita, en un solo lugar</h2>
          <p className="mt-3 text-slate-600">Pensado para el mostrador: rápido para vender y claro para entender cómo va el negocio.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo} className="rounded-2xl border border-slate-200 p-5 transition hover:border-brand-200 hover:shadow-sm">
              <div className="mb-3 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-slate-900">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QR destacado */}
      <section id="qr" className="scroll-mt-20 bg-slate-900 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-sky-300">Cobro con QR automático</p>
            <h2 className="text-3xl font-extrabold">Dejá de mirar el celular para ver si te pagaron</h2>
            <p className="mt-4 text-slate-300">
              Con Mostrador la caja le pide el cobro a Mercado Pago por el monto exacto. El cliente escanea, paga y la venta se registra sola, con el medio
              que usó y su comisión. Si no paga, no hay venta: los comprobantes falsos no sirven.
            </p>
            <ol className="mt-6 space-y-3 text-sm">
              {["Tocás «Cobrar con QR»", "El cliente escanea y paga desde su billetera", "Aparece «Pago aprobado» y la venta queda registrada"].map((t, i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mx-auto w-full max-w-xs rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-xs uppercase tracking-wider text-sky-200">Cobro con QR</div>
            <div className="text-3xl font-extrabold tabular-nums">$ 8.900</div>
            <div className="mx-auto my-5 grid h-40 w-40 grid-cols-7 gap-1 rounded-xl bg-white p-3" aria-hidden>
              {Array.from({ length: 49 }, (_, i) => (
                <span key={i} className={`rounded-[2px] ${[0, 1, 2, 4, 6, 7, 9, 13, 14, 16, 18, 20, 23, 24, 26, 28, 29, 31, 34, 35, 37, 41, 42, 43, 44, 46, 48].includes(i) ? "bg-slate-900" : "bg-white"}`} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-300">
              <Check size={16} /> Pago aprobado · crédito
            </div>
          </div>
        </div>
      </section>

      {/* Cómo empezar */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-3xl font-extrabold text-slate-900">Empezás a vender en una tarde</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: MessageCircle, t: "Escribinos", d: "Te creamos la cuenta de tu negocio y tu usuario de dueño." },
            { icon: Smartphone, t: "Cargá tus productos", d: "Uno por uno o todos juntos desde una planilla de Excel." },
            { icon: BarChart3, t: "Abrí la caja y vendé", d: "Sumá a tus empleados y mirá cómo va el negocio desde donde estés." },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="rounded-2xl bg-slate-50 p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
                <Icon size={20} className="text-brand-600" />
              </div>
              <h3 className="font-bold text-slate-900">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="scroll-mt-20 bg-brand-50/60">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-slate-900">Dos planes, sin sorpresas</h2>
            <p className="mt-3 text-slate-600">Empezá con una prueba gratis. Si te sirve, elegís el plan; si crecés, pasás al completo sin perder nada.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { nombre: "Básico", sub: "Para vender y controlar la caja y el stock", items: BASICO, destacado: false },
              { nombre: "Completo", sub: "Para llevar todo el negocio, con factura electrónica", items: COMPLETO, destacado: true },
            ].map((p) => (
              <div key={p.nombre} className={`relative rounded-2xl border bg-white p-6 ${p.destacado ? "border-brand-500 shadow-lg" : "border-slate-200"}`}>
                {p.destacado && (
                  <span className="absolute -top-3 right-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">El más elegido</span>
                )}
                <h3 className="text-xl font-extrabold text-slate-900">{p.nombre}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.sub}</p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {p.items.map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check size={18} className="mt-px shrink-0 text-emerald-600" /> {i}
                    </li>
                  ))}
                </ul>
                <a
                  href={linkWhatsApp(`Hola! Me interesa el plan ${p.nombre} de Mostrador.`)}
                  className={`mt-6 block rounded-xl px-4 py-3 text-center font-semibold ${
                    p.destacado ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  Consultar precio
                </a>
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-slate-600">
            <ShieldCheck size={16} className="text-brand-600" /> Tus datos son tuyos: los exportás cuando quieras.
          </p>
        </div>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
        <h2 className="mb-8 text-center text-3xl font-extrabold text-slate-900">Preguntas frecuentes</h2>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                {p}
                <ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold">¿Lo probamos en tu kiosco?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">Escribinos y en el día te dejamos la cuenta lista para que empieces a vender.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={WA_PRUEBA} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
              <MessageCircle size={18} /> Escribinos por WhatsApp
            </a>
            <a href={`${MARCA.urlApp}/login`} className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Ya tengo cuenta
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Store size={16} className="text-brand-600" /> Mostrador · {MARCA.dominio}
          </span>
          <span className="flex gap-4">
            <a href={WA_CONSULTA} className="hover:text-brand-600">
              Contacto
            </a>
            <a href={`${MARCA.urlApp}/login`} className="hover:text-brand-600">
              Ingresar
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
