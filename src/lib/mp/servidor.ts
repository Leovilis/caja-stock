// Mercado Pago — cobro con QR (Orders API). SÓLO SERVIDOR.
// Docs: /v1/orders (type "qr"), sucursales /users/{id}/stores y cajas /v2/pos.
import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArcaError } from "@/lib/arca/servicio";

// Permite apuntar a un simulador en pruebas (nunca configurar en producción)
const API = (process.env.MP_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");

/** detalle = estado HTTP que devolvemos al navegador; mpStatus = el que devolvió Mercado Pago */
export class MpError extends ArcaError {
  constructor(
    msg: string,
    detalle?: unknown,
    public mpStatus?: number
  ) {
    super(msg, detalle);
  }
}

/** Mensaje legible de un error de la API de Mercado Pago */
function mensajeMP(status: number, j: Record<string, unknown> | null): string {
  if (status === 401) return "Mercado Pago rechazó el access token (revisá que sea el de producción y esté completo)";
  const errores = (j?.errors as { message?: string; code?: string }[] | undefined) ?? [];
  const detalle = errores.map((e) => e.message || e.code).filter(Boolean).join(" · ") || (j?.message as string) || (j?.error as string) || "";
  if (status === 404 && /pos/i.test(detalle)) return "Mercado Pago no encuentra la caja: volvé a conectar la cuenta en Configuración";
  if (status === 403)
    return (
      "Mercado Pago no le da permiso a esta aplicación para esta operación (403). Revisá: 1) que sea el Access Token de " +
      "PRODUCCIÓN (no el de prueba), 2) que la aplicación sea de «Pagos presenciales / Código QR», y 3) que la aplicación esté " +
      "creada con la misma cuenta que cobra" + (detalle ? ` [${detalle}]` : "")
    );
  return `Mercado Pago respondió ${status}${detalle ? `: ${detalle}` : ""}`;
}

async function mp<T = Record<string, unknown>>(
  token: string,
  ruta: string,
  opts: { method?: string; body?: unknown; idempotencia?: string } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + ruta, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts.idempotencia ? { "X-Idempotency-Key": opts.idempotencia } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MpError("No se pudo conectar con Mercado Pago. Probá de nuevo.", 502);
  }
  const texto = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!res.ok) throw new MpError(mensajeMP(res.status, json), res.status >= 500 ? 502 : 400, res.status);
  return (json ?? {}) as T;
}

/* ------------------------------------------------------------------ */
/* Cuenta, sucursal y caja                                             */
/* ------------------------------------------------------------------ */
export interface UsuarioMP {
  id: number;
  nickname: string;
  site_id: string;
}
/**
 * Datos de la cuenta dueña del token. Si /users/me no está permitido para la aplicación (403),
 * el id sale del propio token: APP_USR-<app>-<fecha>-<hash>-<user_id>.
 */
export async function mpUsuario(token: string, userIdManual?: string | number | null): Promise<UsuarioMP> {
  try {
    return await mp<UsuarioMP>(token, "/users/me");
  } catch (e) {
    if ((e as MpError).mpStatus !== 403) throw e;
    const manual = Number(String(userIdManual ?? "").replace(/\D/g, ""));
    const delToken = Number(token.trim().match(/-(\d{5,})\s*$/)?.[1]);
    const id = manual > 0 ? manual : delToken;
    if (Number.isInteger(id) && id > 0) return { id, nickname: "", site_id: "MLA" };
    throw new MpError(
      "Mercado Pago no deja consultar los datos de la cuenta con este token. Completá el campo «User ID» " +
        "(está en Mercado Pago Developers → Tus integraciones → tu aplicación, junto a las credenciales) y volvé a conectar.",
      400,
      403
    );
  }
}

export interface SucursalMP {
  id: string;
  name: string;
  external_id?: string;
  location?: { address_line?: string };
}
export async function mpSucursales(token: string, userId: number): Promise<SucursalMP[]> {
  try {
    const r = await mp<{ results?: SucursalMP[] }>(token, `/users/${userId}/stores/search?limit=50`);
    return (r.results ?? []).map((s) => ({ ...s, id: String(s.id) }));
  } catch {
    return []; // si la búsqueda falla, se ofrece crear una
  }
}

export interface NuevaSucursal {
  nombre: string;
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  referencia?: string;
}
const soloAlfanum = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

export async function mpCrearSucursal(token: string, userId: number, comercioId: string, d: NuevaSucursal) {
  const r = await mp<SucursalMP>(token, `/users/${userId}/stores`, {
    method: "POST",
    body: {
      name: d.nombre.slice(0, 60),
      external_id: ("CS" + soloAlfanum(comercioId).slice(0, 12) + Date.now().toString(36)).slice(0, 60).toUpperCase(),
      location: {
        street_number: d.numero,
        street_name: d.calle,
        city_name: d.ciudad,
        state_name: d.provincia,
        latitude: d.latitud,
        longitude: d.longitud,
        reference: d.referencia || d.nombre,
      },
    },
  });
  return { ...r, id: String(r.id) };
}

export interface CajaMP {
  id: number | string;
  external_id: string;
  qr?: { image?: string; template_document?: string };
  qr_response?: { image?: string; template_document?: string; template_image?: string; qr_code?: string };
}
export async function mpCrearCaja(token: string, storeId: string, comercioId: string): Promise<CajaMP> {
  const externo = ("CSPOS" + soloAlfanum(comercioId).slice(0, 20) + Math.random().toString(36).slice(2, 8)).toUpperCase().slice(0, 40);
  return mp<CajaMP>(token, "/v2/pos", {
    method: "POST",
    idempotencia: randomUUID(),
    body: { name: "Caja y Stock", store_id: storeId, external_id: externo, config: { qr: { operating_mode: "pdv" } } },
  });
}

/* ------------------------------------------------------------------ */
/* Órdenes de cobro                                                    */
/* ------------------------------------------------------------------ */
export interface OrdenMP {
  id: string;
  status: string;
  status_detail?: string;
  total_amount?: string;
  type_response?: { qr_data?: string };
  transactions?: {
    payments?: {
      id: string;
      amount: string;
      paid_amount?: string;
      status: string;
      status_detail?: string;
      payment_method?: { id?: string; type?: string; installments?: number };
    }[];
  };
}

const importe = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * Crea la orden en la caja del comercio. Modo "hybrid": sirve el QR impreso de la caja y además
 * devuelve un QR único (qr_data) para mostrar en pantalla. Si la cuenta no admite hybrid, usa el estático.
 */
export async function mpCrearOrden(token: string, externalPosId: string, monto: number, referencia: string, descripcion: string) {
  const cuerpo = (modo: "hybrid" | "static") => ({
    type: "qr",
    total_amount: importe(monto),
    description: descripcion.slice(0, 150),
    external_reference: referencia,
    expiration_time: "PT10M",
    config: { qr: { external_pos_id: externalPosId, mode: modo } },
    transactions: { payments: [{ amount: importe(monto) }] },
  });
  try {
    return await mp<OrdenMP>(token, "/v1/orders", { method: "POST", idempotencia: randomUUID(), body: cuerpo("hybrid") });
  } catch (e) {
    if ((e as MpError).mpStatus === 400) {
      return mp<OrdenMP>(token, "/v1/orders", { method: "POST", idempotencia: randomUUID(), body: cuerpo("static") });
    }
    throw e;
  }
}

export const mpOrden = (token: string, id: string) => mp<OrdenMP>(token, `/v1/orders/${encodeURIComponent(id)}`);

/** Cancela una orden todavía no pagada (la API documenta POST /cancel; algunos ejemplos usan PUT) */
export async function mpCancelarOrden(token: string, id: string) {
  try {
    return await mp<OrdenMP>(token, `/v1/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", idempotencia: randomUUID() });
  } catch (e) {
    if ([400, 404, 405].includes(Number((e as MpError).mpStatus))) {
      return mp<OrdenMP>(token, `/v1/orders/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "canceled" } });
    }
    throw e;
  }
}

export type EstadoCobro = "pendiente" | "aprobado" | "cancelado" | "vencido" | "rechazado";

/** Traduce la orden de MP a nuestro estado. Aprobado sólo si la orden y el pago están procesados y por el monto pedido. */
export function estadoDeOrden(o: OrdenMP, montoPedido: number): { estado: EstadoCobro; tipo: string | null; pagoId: string | null } {
  const pago = o.transactions?.payments?.[0];
  const tipo = pago?.payment_method?.type ?? null;
  const pagoId = pago?.id ?? null;
  const st = (o.status || "").toLowerCase();
  if (st === "processed") {
    const pagado = Number(pago?.paid_amount ?? pago?.amount ?? o.total_amount ?? 0);
    const ok = pago && ["processed", "accredited", "approved"].includes((pago.status || "").toLowerCase()) && Math.abs(pagado - montoPedido) < 0.01;
    return { estado: ok ? "aprobado" : "pendiente", tipo, pagoId };
  }
  if (st === "canceled" || st === "cancelled") return { estado: "cancelado", tipo, pagoId };
  if (st === "expired") return { estado: "vencido", tipo, pagoId };
  if (st === "failed" || st === "refunded" || st === "rejected") return { estado: "rechazado", tipo, pagoId };
  return { estado: "pendiente", tipo, pagoId };
}

/* ------------------------------------------------------------------ */
/* Token del comercio (Vault)                                          */
/* ------------------------------------------------------------------ */
export async function tokenComercio(db: SupabaseClient, comercioId: string): Promise<string> {
  const { data, error } = await db.rpc("mp_token", { p_comercio: comercioId });
  if (error) throw new MpError("No se pudo leer el token de Mercado Pago: " + error.message, 500);
  if (!data) throw new MpError("Este comercio no tiene Mercado Pago conectado (Configuración → Mercado Pago)", 400);
  return String(data);
}

export async function guardarToken(db: SupabaseClient, comercioId: string, token: string | null) {
  const { error } = await db.rpc("mp_guardar_token", { p_comercio: comercioId, p_token: token });
  if (error) throw new MpError("No se pudo guardar el token: " + error.message, 500);
}
