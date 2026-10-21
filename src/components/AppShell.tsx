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
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Loading } from "./ui";

const NAV = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, admin: true },
  { href: "/pos", label: "Punto de venta", icon: ShoppingCart },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/ventas", label: "Ventas", icon: Receipt },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes, admin: true },
  { href: "/compras", label: "Compras", icon: PackagePlus, admin: true },
  { href: "/proveedores", label: "Proveedores", icon: Truck, admin: true },
  { href: "/gastos", label: "Gastos", icon: ClipboardList, admin: true },
  { href: "/reportes", label: "Reportes", icon: BarChart3, admin: true },
  { href: "/libro", label: "Libro consolidado", icon: BookOpenCheck, admin: true },
  { href: "/usuarios", label: "Usuarios", icon: Users, admin: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, admin: true },
];

/** Rutas que sólo puede ver un administrador */
const SOLO_ADMIN = NAV.filter((n) => n.admin).map((n) => n.href);

export function AppShell({ children }: { children: ReactNode }) {
  const { user, perfil, cargando, esAdmin, salir, caja, config } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!cargando && !user) router.replace("/login");
  }, [cargando, user, router]);

  useEffect(() => {
    if (perfil && !esAdmin && SOLO_ADMIN.includes(path)) router.replace("/pos");
  }, [perfil, esAdmin, path, router]);

  useEffect(() => setAbierto(false), [path]);

  if (cargando || !user) return <Loading />;

  if (!perfil || !perfil.activo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-sm p-6 text-center">
          <h2 className="text-lg font-semibold">Usuario sin acceso</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tu cuenta ({user.email}) no está habilitada. Pedile al administrador que te dé de alta o te reactive.
          </p>
          <button className="btn-ghost mt-4" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => esAdmin || !n.admin);
  const esPOS = path === "/pos";

  const sidebar = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="rounded-lg bg-brand-600 p-2 text-white">
          <Store size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-white">{config.nombre}</div>
          <div className="text-xs text-slate-400">Caja & Stock</div>
        </div>
      </div>
      <div className="mx-4 mb-3 rounded-lg bg-slate-800 px-3 py-2 text-xs">
        Caja:{" "}
        {caja ? (
          <span className="font-semibold text-emerald-400">ABIERTA</span>
        ) : (
          <span className="font-semibold text-rose-400">CERRADA</span>
        )}
      </div>
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
            </Link>
          );
        })}
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="truncate text-sm font-medium text-white">{perfil.nombre}</div>
        <div className="text-xs capitalize text-slate-400">{perfil.rol}</div>
        <button onClick={salir} className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
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
          <span className="font-semibold">{config.nombre}</span>
        </header>
        <main className={esPOS ? "flex-1 p-3 lg:p-4" : "flex-1 p-4 lg:p-8"}>{children}</main>
      </div>
    </div>
  );
}
