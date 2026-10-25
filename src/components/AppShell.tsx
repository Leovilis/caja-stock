"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  ClipboardList,
  Store,
  X,
  PackagePlus,
  BookOpenCheck,
  Clock,
  Lock,
  Building2,
  KeyRound,
  Banknote,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Loading } from "./ui";
import { CambiarClaveModal } from "./CambiarClaveModal";
import { useVencimientos } from "@/hooks/useVencimientos";
import type { Modulo } from "@/lib/types";

const NAV: { href: string; label: string; icon: typeof Store; modulo?: Modulo; admin?: boolean; superadmin?: boolean }[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, modulo: "inicio", admin: true },
  { href: "/pos", label: "Punto de venta", icon: ShoppingCart, modulo: "pos" },
  { href: "/caja", label: "Caja", icon: Wallet, modulo: "caja" },
  { href: "/ventas", label: "Ventas", icon: Receipt, modulo: "ventas" },
  { href: "/productos", label: "Productos", icon: Package, modulo: "productos" },
  { href: "/stock", label: "Stock", icon: Boxes, modulo: "stock", admin: true },
  { href: "/compras", label: "Compras", icon: PackagePlus, modulo: "compras", admin: true },
  { href: "/proveedores", label: "Proveedores", icon: Truck, modulo: "proveedores", admin: true },
  { href: "/pagos", label: "Pagos a proveedores", icon: Banknote, modulo: "compras", admin: true },
  { href: "/gastos", label: "Gastos", icon: ClipboardList, modulo: "gastos", admin: true },
  { href: "/reportes", label: "Reportes", icon: BarChart3, modulo: "reportes", admin: true },
  { href: "/libro", label: "Libro consolidado", icon: BookOpenCheck, modulo: "libro", admin: true },
  { href: "/usuarios", label: "Usuarios", icon: Users, modulo: "usuarios", admin: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, modulo: "configuracion", admin: true },
  { href: "/clientes", label: "Clientes", icon: Building2, superadmin: true },
];

/** Rutas que sólo puede ver un administrador */
const SOLO_ADMIN = NAV.filter((n) => n.admin).map((n) => n.href);
/** Rutas del administrador general */
const SOLO_SUPERADMIN = NAV.filter((n) => n.superadmin).map((n) => n.href);

/** "2026-11-30" → "30/11/2026" */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/** Módulo al que pertenece una ruta (o null si no es una sección del menú) */
const moduloDeRuta = (path: string) =>
  NAV.find((n) => (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/")))?.modulo ?? null;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, perfil, cargando, esAdmin, salir, caja, config, licencia, modulo, diasRestantes, vencida, esSuperadmin } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [miClave, setMiClave] = useState(false);
  // Vencimientos para revisar (contador en el menú "Stock")
  const { alertas: alertasVenc } = useVencimientos(!!perfil?.activo && esAdmin && modulo("stock"));

  useEffect(() => {
    if (!cargando && !user) router.replace("/login");
  }, [cargando, user, router]);

  useEffect(() => {
    if (perfil && !esAdmin && SOLO_ADMIN.includes(path)) router.replace("/pos");
  }, [perfil, esAdmin, path, router]);

  // Secciones que no incluye el plan contratado
  const modRuta = moduloDeRuta(path);
  const fueraDelPlan = !!modRuta && !modulo(modRuta);
  useEffect(() => {
    if (perfil && fueraDelPlan) router.replace("/pos");
  }, [perfil, fueraDelPlan, router]);

  // Administrador general sin comercio: sólo administra clientes (no vende)
  const modoAdmin = esSuperadmin && !perfil?.activo;
  useEffect(() => {
    if (cargando || !user) return;
    if (!esSuperadmin && SOLO_SUPERADMIN.includes(path)) router.replace("/pos");
    else if (modoAdmin && !SOLO_SUPERADMIN.includes(path)) router.replace("/clientes");
  }, [cargando, user, esSuperadmin, modoAdmin, path, router]);

  useEffect(() => setAbierto(false), [path]);

  if (cargando || !user) return <Loading />;

  if (!modoAdmin && (!perfil || !perfil.activo)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-sm p-6 text-center">
          <h2 className="text-lg font-semibold">Usuario sin acceso</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tu cuenta ({user.email}) no está habilitada en ningún comercio. Pedile al administrador de tu comercio que te dé de alta o te reactive.
          </p>
          <button className="btn-ghost mt-4" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const items = modoAdmin
    ? NAV.filter((n) => n.superadmin)
    : NAV.filter((n) => (n.superadmin ? esSuperadmin : (esAdmin || !n.admin) && (!n.modulo || modulo(n.modulo))));
  const esBasico = licencia.plan === "basico";
  const contacto = licencia.contacto || "tu proveedor del sistema";
  // Con plan básico y fecha de vencimiento lo tratamos como prueba; con plan completo, como abono
  const esPrueba = esBasico;
  const quien = esPrueba ? "La prueba" : "La licencia";
  const aviso = modoAdmin ? null : !licencia.activo ? (
    <div className="flex items-start gap-2 bg-rose-600 px-4 py-2 text-sm text-white">
      <Lock size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>El sistema está suspendido para este comercio.</b> Podés consultar todo y cerrar la caja, pero no registrar ventas ni cambios. Contactá a {contacto} para reactivarlo.
      </span>
    </div>
  ) : vencida ? (
    <div className="flex items-start gap-2 bg-rose-600 px-4 py-2 text-sm text-white">
      <Lock size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>{esPrueba ? "El período de prueba" : "La licencia"} venció el {fechaCorta(licencia.vence!)}.</b> Podés consultar todo y cerrar la caja, pero no registrar ventas ni cambios. Contactá a {contacto} para seguir usándolo.
      </span>
    </div>
  ) : diasRestantes !== null && diasRestantes <= 7 ? (
    <div className="flex items-start gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <Clock size={16} className="mt-0.5 shrink-0" />
      <span>
        {diasRestantes === 0 ? `${quien} vence hoy.` : `${quien} vence en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}.`} Para seguir usándolo, contactá a {contacto}.
      </span>
    </div>
  ) : null;
  const esPOS = path === "/pos";

  const sidebar = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="rounded-lg bg-brand-600 p-2 text-white">
          <Store size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-white">{modoAdmin ? "Mi Kioskito" : config.nombre}</div>
          <div className="text-xs text-slate-400">{modoAdmin ? "Administración general" : `Mi Kioskito${esBasico ? " · Plan básico" : ""}`}</div>
        </div>
      </div>
      {!modoAdmin && (
        <div className="mx-4 mb-3 rounded-lg bg-slate-800 px-3 py-2 text-xs">
          Caja:{" "}
          {caja ? (
            <span className="font-semibold text-emerald-400">ABIERTA</span>
          ) : (
            <span className="font-semibold text-rose-400">CERRADA</span>
          )}
          {diasRestantes !== null && (
            <div className={`mt-1 ${diasRestantes < 0 ? "text-rose-400" : "text-slate-400"}`}>
              {diasRestantes < 0 ? "Licencia vencida" : `${esPrueba ? "Prueba" : "Licencia"} hasta el ${fechaCorta(licencia.vence!)}`}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const activo = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                activo ? "bg-brand-600 text-white" : "hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
              {href === "/stock" && alertasVenc > 0 && (
                <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white" title="Vencimientos para revisar">
                  {alertasVenc}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="truncate text-sm font-medium text-white">{modoAdmin ? user.email : perfil!.nombre}</div>
        <div className="text-xs capitalize text-slate-400">{modoAdmin ? "Administrador general" : perfil!.rol}</div>
        {(esAdmin || modoAdmin) && (
          <button onClick={() => setMiClave(true)} className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <KeyRound size={14} /> Cambiar mi contraseña
          </button>
        )}
        <button onClick={salir} className="mt-2 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button className="absolute right-4 top-4 text-white" onClick={() => setAbierto(false)}>
            <X />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setAbierto(true)} aria-label="Menú">
            <Menu />
          </button>
          <span className="font-semibold">{modoAdmin ? "Administración general" : config.nombre}</span>
        </header>
        {aviso}
        <main className={esPOS ? "flex-1 p-3 lg:p-4" : "flex-1 p-4 lg:p-8"}>{children}</main>
      </div>
      <CambiarClaveModal email={miClave ? user.email ?? null : null} propia onClose={() => setMiClave(false)} />
    </div>
  );
}
