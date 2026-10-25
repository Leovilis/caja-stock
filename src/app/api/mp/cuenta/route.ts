import { admin, respuestaError, usuarioDesdeRequest } from "@/lib/arca/servidor";
import { guardarToken, mpCrearCaja, mpCrearSucursal, mpSucursales, mpUsuario, MpError, type NuevaSucursal } from "@/lib/mp/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Conectar la cuenta de Mercado Pago del comercio (sólo administradores, cualquier plan).
 * Paso 1: POST { token }                       → { paso: "sucursal", nickname, sucursales }
 * Paso 2: POST { token, store_id | sucursal }  → crea la caja "Caja y Stock" y guarda todo → { paso: "listo", cuenta }
 */
export async function POST(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req, { cualquierPlan: true });
    if (perfil.rol !== "admin") return Response.json({ error: "Sólo administradores" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    if (!/^APP_USR-|^TEST-/.test(token)) {
      return Response.json({ error: "Pegá el Access Token de producción (empieza con APP_USR-)" }, { status: 400 });
    }
    const paso = async <T>(nombre: string, fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        const err = e as MpError;
        throw new MpError(`${nombre}: ${err.message}`, err.detalle, err.mpStatus);
      }
    };
    const usuario = await paso("Al verificar la cuenta", () => mpUsuario(token, body.user_id));

    if (!body.store_id && !body.sucursal) {
      const sucursales = await mpSucursales(token, usuario.id);
      return Response.json({
        paso: "sucursal",
        nickname: usuario.nickname,
        pais: usuario.site_id,
        sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.name, direccion: s.location?.address_line ?? "" })),
      });
    }

    let storeId = String(body.store_id ?? "");
    let storeNombre = String(body.store_nombre ?? "");
    if (!storeId) {
      const d = body.sucursal as NuevaSucursal;
      const faltan = !d?.nombre || !d.calle || !d.numero || !d.ciudad || !d.provincia || !Number.isFinite(Number(d.latitud)) || !Number.isFinite(Number(d.longitud));
      if (faltan) throw new MpError("Completá todos los datos de la sucursal (incluida la ubicación)", 400);
      const s = await paso("Al crear la sucursal", () =>
        mpCrearSucursal(token, usuario.id, perfil.comercio_id, { ...d, latitud: Number(d.latitud), longitud: Number(d.longitud) })
      );
      storeId = s.id;
      storeNombre = s.name;
    }

    const caja = await paso("Al crear la caja", () => mpCrearCaja(token, storeId, perfil.comercio_id));
    const qr = caja.qr_response ?? caja.qr ?? {};
    const db = admin();
    await guardarToken(db, perfil.comercio_id, token);
    const cuenta = {
      comercio_id: perfil.comercio_id,
      user_id: String(usuario.id),
      nickname: usuario.nickname ?? "",
      store_id: storeId,
      store_nombre: storeNombre,
      pos_id: String(caja.id),
      external_pos_id: caja.external_id,
      qr_imagen: qr.image ?? null,
      qr_pdf: qr.template_document ?? null,
      conectado: new Date().toISOString(),
    };
    const { error } = await db.from("mp_cuentas").upsert(cuenta);
    if (error) throw new MpError("No se pudo guardar la cuenta: " + error.message, 500);
    return Response.json({ paso: "listo", cuenta });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Desconectar: borra el token y los datos de la caja (la caja queda creada en Mercado Pago) */
export async function DELETE(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req, { cualquierPlan: true });
    if (perfil.rol !== "admin") return Response.json({ error: "Sólo administradores" }, { status: 403 });
    const db = admin();
    await guardarToken(db, perfil.comercio_id, null);
    await db.from("mp_cuentas").delete().eq("comercio_id", perfil.comercio_id);
    return Response.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
