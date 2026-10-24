// Orquestación de facturación: valida, pide CAE y guarda el comprobante. SÓLO SERVIDOR.
import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  calcularImportes,
  cuitValido,
  letraPara,
  TIPO_CBTE,
  validarReceptor,
  type CondicionFiscal,
  type Letra,
} from "./calculo";
import { ArcaError, loginWSAA, solicitarCAE, ultimoAutorizado, type Ambiente, type TA } from "./servicio";

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest\/v1)?\/?$/, "");
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const SECRET = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Next.js cachea fetch() en el servidor: para datos de facturación siempre hay que leer en vivo
const sinCache: typeof fetch = (url, opts) => fetch(url, { ...opts, cache: "no-store" });

export function admin(): SupabaseClient {
  if (!SECRET) throw new ArcaError("Falta SUPABASE_SECRET_KEY (clave secreta de Supabase) en las variables del servidor");
  return createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: sinCache } });
}

export function clienteUsuario(token: string): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: sinCache },
  });
}

export interface Perfil {
  id: string;
  nombre: string;
  rol: "admin" | "vendedor";
  activo: boolean;
}

/** Valida el token del usuario que llama y devuelve su perfil activo */
export async function usuarioDesdeRequest(req: Request): Promise<{ perfil: Perfil; token: string }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new ArcaError("Sesión no válida", 401);
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ArcaError("Sesión vencida: volvé a ingresar", 401);
  const { data: perfil } = await db.from("perfiles").select("id, nombre, rol, activo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.activo) throw new ArcaError("Usuario no habilitado", 403);
  // Plan y vencimiento (si la tabla no existe todavía, se toma como plan completo)
  const { data: lic } = await db.from("licencia").select("plan, vence").eq("id", 1).maybeSingle();
  if (lic?.plan === "basico") throw new ArcaError("La facturación electrónica no está incluida en el plan básico", 403);
  const hoyAR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  if (lic?.vence && hoyAR > lic.vence) throw new ArcaError("La licencia del sistema venció", 403);
  return { perfil: perfil as Perfil, token };
}

export interface ConfigFiscal {
  condicion: CondicionFiscal;
  cuit: string;
  razonSocial: string;
  puntoVenta: number;
  ambiente: Ambiente;
}

export async function configFiscal(db: SupabaseClient): Promise<ConfigFiscal> {
  const { data: c } = await db.from("config").select("*").eq("id", 1).single();
  if (!c) throw new ArcaError("Falta la configuración del negocio");
  const cuit = String(c.fiscal_cuit ?? "").replace(/\D/g, "");
  if (!cuitValido(cuit)) throw new ArcaError("Configurá un CUIT válido del emisor en Configuración → Facturación");
  if (!c.fiscal_razon_social) throw new ArcaError("Configurá la razón social en Configuración → Facturación");
  if (!(c.fiscal_punto_venta > 0)) throw new ArcaError("Configurá el punto de venta en Configuración → Facturación");
  return {
    condicion: c.fiscal_condicion,
    cuit,
    razonSocial: c.fiscal_razon_social,
    puntoVenta: Number(c.fiscal_punto_venta),
    ambiente: c.fiscal_ambiente,
  };
}

/* ------------------------------------------------------------------ */
/* Ticket de acceso con caché en la base                               */
/* ------------------------------------------------------------------ */
export async function obtenerTA(db: SupabaseClient, ambiente: Ambiente, cuit: string): Promise<TA> {
  const leer = async () => {
    const { data } = await db
      .from("arca_ta")
      .select("*")
      .eq("servicio", "wsfe")
      .eq("ambiente", ambiente)
      .eq("cuit", cuit)
      .gt("expira", new Date(Date.now() + 5 * 60_000).toISOString())
      .maybeSingle();
    return data ? { token: data.token, sign: data.sign, expira: new Date(data.expira) } : null;
  };
  const cache = await leer();
  if (cache) return cache;
  try {
    const ta = await loginWSAA(ambiente, "wsfe");
    await db.from("arca_ta").upsert({ servicio: "wsfe", ambiente, cuit, token: ta.token, sign: ta.sign, expira: ta.expira.toISOString() });
    return ta;
  } catch (e) {
    // Otro pedido simultáneo pudo haberlo obtenido y guardado recién
    await new Promise((r) => setTimeout(r, 1500));
    const otra = await leer();
    if (otra) return otra;
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const hoyAR = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { iso: p, compacta: p.replace(/-/g, "") };
};
const isoDe = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

async function tomarVenta(db: SupabaseClient, ventaId: string) {
  // Marca atómica: si otro pedido está facturando esta venta, el UPDATE no devuelve filas
  // (sin filtros "or" en el UPDATE: PostgREST 12 falla con ellos en mutaciones)
  const ahora = new Date().toISOString();
  const libre = await db.from("ventas").update({ facturando: ahora }).eq("id", ventaId).is("facturando", null).select("id");
  if (libre.error) throw new ArcaError(libre.error.message);
  if (libre.data?.length) return;
  // marca vieja (un pedido anterior que se cortó a mitad de camino)
  const vieja = await db
    .from("ventas")
    .update({ facturando: ahora })
    .eq("id", ventaId)
    .lt("facturando", new Date(Date.now() - 2 * 60_000).toISOString())
    .select("id");
  if (vieja.error) throw new ArcaError(vieja.error.message);
  if (!vieja.data?.length) throw new ArcaError("Esta venta ya se está facturando en otra pantalla. Esperá unos segundos.");
}
const soltarVenta = (db: SupabaseClient, ventaId: string) => db.from("ventas").update({ facturando: null }).eq("id", ventaId);

interface PedidoCAE {
  cfg: ConfigFiscal;
  tipo: number;
  docTipo: number;
  docNro: number;
  condicion: number;
  imp: { imp_total: number; imp_neto: number; imp_iva: number; iva: { id: number; base: number; importe: number }[] };
  asociado?: { tipo: number; ptoVta: number; numero: number; cuit: string; fecha: string };
}

/** Numera y pide el CAE (reintenta una vez si otro comprobante tomó el número) */
async function pedirCAE(db: SupabaseClient, p: PedidoCAE) {
  const ta = await obtenerTA(db, p.cfg.ambiente, p.cfg.cuit);
  const fecha = hoyAR();
  for (let intento = 0; intento < 2; intento++) {
    const numero = (await ultimoAutorizado(p.cfg.ambiente, ta, p.cfg.cuit, p.cfg.puntoVenta, p.tipo)) + 1;
    const r = await solicitarCAE(p.cfg.ambiente, ta, p.cfg.cuit, {
      ptoVta: p.cfg.puntoVenta,
      tipo: p.tipo,
      numero,
      fecha: fecha.compacta,
      docTipo: p.docTipo,
      docNro: p.docNro,
      condicionReceptor: p.condicion,
      impTotal: p.imp.imp_total,
      impNeto: p.imp.imp_neto,
      impIva: p.imp.imp_iva,
      iva: p.imp.iva,
      asociado: p.asociado,
    });
    if (r.aprobado) return { numero, fecha: fecha.iso, cae: r.cae!, caeVto: isoDe(r.caeVto!), observaciones: r.observaciones };
    const numeroOcupado = r.errores.some((e) => e.startsWith("10016"));
    if (numeroOcupado && intento === 0) continue;
    throw new ArcaError("ARCA rechazó el comprobante: " + [...r.errores, ...r.observaciones].join(" | "), r);
  }
  throw new ArcaError("No se pudo numerar el comprobante");
}

async function guardar(db: SupabaseClient, fila: Record<string, unknown>) {
  const { data, error } = await db.from("comprobantes").insert(fila).select("*").single();
  if (error) {
    // El comprobante YA está autorizado en ARCA: no perder los datos
    throw new ArcaError(
      `El comprobante fue AUTORIZADO por ARCA (tipo ${fila.tipo}, PV ${fila.punto_venta}, N° ${fila.numero}, CAE ${fila.cae}) pero no se pudo guardar: ${error.message}. Anotá estos datos.`,
      fila
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Casos de uso                                                        */
/* ------------------------------------------------------------------ */
export interface Receptor {
  docTipo: number;
  docNro: number;
  condicion: number;
  nombre?: string;
  domicilio?: string;
}

export async function facturarVenta(perfil: Perfil, ventaId: string, rec: Receptor) {
  const db = admin();
  const cfg = await configFiscal(db);
  const { data: venta } = await db.from("ventas").select("*, venta_items(*), comprobantes(*)").eq("id", ventaId).maybeSingle();
  if (!venta) throw new ArcaError("La venta no existe");
  if (venta.estado !== "completada") throw new ArcaError("No se puede facturar una venta anulada");
  if ((venta.comprobantes ?? []).some((c: { clase: string }) => c.clase === "factura")) throw new ArcaError("Esta venta ya está facturada");
  // El vendedor sólo factura ventas de su turno (las que ve); el admin, cualquiera
  if (perfil.rol !== "admin") {
    const { data: caja } = await db.from("cajas").select("id").eq("estado", "abierta").maybeSingle();
    if (venta.caja_id !== caja?.id) throw new ArcaError("Sólo un administrador puede facturar ventas de turnos anteriores");
  }

  const docTipo = Number(rec.docTipo);
  const docNro = docTipo === 99 ? 0 : Number(String(rec.docNro).replace(/\D/g, ""));
  const letra: Letra = letraPara(cfg.condicion, Number(rec.condicion));
  const err = validarReceptor(letra, docTipo, docNro, Number(rec.condicion));
  if (err) throw new ArcaError(err);
  const imp = calcularImportes(letra, venta.venta_items, Number(venta.total));
  if (imp.imp_total <= 0) throw new ArcaError("La venta no tiene importe para facturar");
  const tipo = TIPO_CBTE.factura[letra];

  await tomarVenta(db, ventaId);
  try {
    const r = await pedirCAE(db, { cfg, tipo, docTipo, docNro, condicion: Number(rec.condicion), imp });
    return await guardar(db, {
      venta_id: ventaId,
      clase: "factura",
      letra,
      tipo,
      punto_venta: cfg.puntoVenta,
      numero: r.numero,
      fecha: r.fecha,
      cae: r.cae,
      cae_vto: r.caeVto,
      doc_tipo: docTipo,
      doc_nro: docNro,
      receptor_nombre: (rec.nombre ?? "").trim(),
      receptor_domicilio: (rec.domicilio ?? "").trim(),
      receptor_condicion: Number(rec.condicion),
      imp_total: imp.imp_total,
      imp_neto: imp.imp_neto,
      imp_iva: imp.imp_iva,
      iva: imp.iva,
      ambiente: cfg.ambiente,
      emisor_cuit: cfg.cuit,
      emitido_por: perfil.nombre,
      observaciones: r.observaciones.join(" | ") || null,
    });
  } finally {
    await soltarVenta(db, ventaId);
  }
}

/** Emite la nota de crédito por el total de la factura de la venta (antes de anularla) */
export async function notaCreditoVenta(perfil: Perfil, ventaId: string) {
  if (perfil.rol !== "admin") throw new ArcaError("Sólo un administrador puede emitir notas de crédito", 403);
  const db = admin();
  const cfg = await configFiscal(db);
  const { data: comps } = await db.from("comprobantes").select("*").eq("venta_id", ventaId);
  const fac = (comps ?? []).find((c) => c.clase === "factura");
  if (!fac) throw new ArcaError("La venta no tiene factura");
  const nc = (comps ?? []).find((c) => c.clase === "nota_credito");
  if (nc) return nc; // ya emitida (reintento de una anulación que falló)
  if (fac.emisor_cuit !== cfg.cuit || fac.ambiente !== cfg.ambiente)
    throw new ArcaError("La factura se emitió con otro CUIT o ambiente que el configurado actualmente");

  const letra = fac.letra as Letra;
  const tipo = TIPO_CBTE.nota_credito[letra];
  await tomarVenta(db, ventaId);
  try {
    const r = await pedirCAE(db, {
      cfg: { ...cfg, puntoVenta: fac.punto_venta },
      tipo,
      docTipo: fac.doc_tipo,
      docNro: Number(fac.doc_nro),
      condicion: fac.receptor_condicion,
      imp: { imp_total: Number(fac.imp_total), imp_neto: Number(fac.imp_neto), imp_iva: Number(fac.imp_iva), iva: fac.iva },
      asociado: { tipo: fac.tipo, ptoVta: fac.punto_venta, numero: Number(fac.numero), cuit: cfg.cuit, fecha: String(fac.fecha).replace(/-/g, "") },
    });
    return await guardar(db, {
      venta_id: ventaId,
      clase: "nota_credito",
      letra,
      tipo,
      punto_venta: fac.punto_venta,
      numero: r.numero,
      fecha: r.fecha,
      cae: r.cae,
      cae_vto: r.caeVto,
      doc_tipo: fac.doc_tipo,
      doc_nro: fac.doc_nro,
      receptor_nombre: fac.receptor_nombre,
      receptor_domicilio: fac.receptor_domicilio,
      receptor_condicion: fac.receptor_condicion,
      imp_total: fac.imp_total,
      imp_neto: fac.imp_neto,
      imp_iva: fac.imp_iva,
      iva: fac.iva,
      asociado_id: fac.id,
      ambiente: cfg.ambiente,
      emisor_cuit: cfg.cuit,
      emitido_por: perfil.nombre,
      observaciones: r.observaciones.join(" | ") || null,
    });
  } finally {
    await soltarVenta(db, ventaId);
  }
}

/** Respuesta JSON uniforme para las rutas */
export function respuestaError(e: unknown) {
  const err = e as ArcaError;
  const status = typeof err.detalle === "number" ? err.detalle : 400;
  console.error("[ARCA]", err.message, typeof err.detalle === "object" ? JSON.stringify(err.detalle).slice(0, 1000) : "");
  return Response.json({ error: err.message ?? String(e) }, { status });
}
