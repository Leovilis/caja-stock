import { NextResponse, type NextRequest } from "next/server";
import { MARCA } from "@/lib/marca";

/**
 * Un solo deploy para dos direcciones:
 *  - mikioskito.com.ar (y www.)  → página de presentación
 *  - app.mikioskito.com.ar       → la aplicación (y también *.vercel.app y localhost)
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (host !== MARCA.dominio && host !== `www.${MARCA.dominio}`) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL("/landing", req.url));
  if (pathname.startsWith("/landing")) return NextResponse.next();
  // cualquier pantalla de la app pedida en el dominio principal (ej: /login) → a app.
  return NextResponse.redirect(`${MARCA.urlApp}${pathname}${search}`, 308);
}

export const config = {
  // no tocar archivos estáticos ni rutas internas
  matcher: ["/((?!_next/|api/|favicon|icon\\.svg|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)"],
};
