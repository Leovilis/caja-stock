import { randomUUID } from "crypto";
import { admin, respuestaError, usuarioDesdeRequest } from "@/lib/arca/servidor";
import { estadoDeOrden, mpCancelarOrden, mpCrearOrden, mpOrden, MpError, tokenComercio } from "@/lib/mp/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 30;

/** POST { monto } → crea la orden de cobro con QR en la caja del comercio */
export async function POST(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req, { cualquierPlan: true });
    const body = await req.json().catch(() => ({}));
    const monto = Math.round(Number(body.monto) * 100) / 100;
    if (!(monto >= 1)) return Response.json({ error: "Monto inválido" }, { status: 400 });
    const db = admin();
    const [{ data: cuenta }, { data: caja }, { data: cfg }] = await Promise.all([
      db.from("mp_cuentas").select("*").eq("comercio_id", perfil.comercio_id).maybeSingle(),
      db.from("cajas").select("id").eq("comercio_id", perfil.comercio_id).eq("estado", "abierta").maybeSingle(),
      db.from("config").select("nombre").eq("comercio_id", perfil.comercio_id).maybeSingle(),
    ]);
    if (!cuenta) throw new MpError("Este comercio no tiene Mercado Pago conectado (Configuración → Mercado Pago)", 400);
    if (!caja) throw new MpError("La caja está cerrada", 400);
    const token = await tokenComercio(db, perfil.comercio_id);

    // La caja de MP admite una orden activa a la vez: se cancelan las que quedaron colgadas (best effort)
    const { data: colgados } = await db.from("mp_cobros").select("id, order_id, monto").eq("comercio_id", perfil.comercio_id).eq("estado", "pendiente");
    for (const c of colgados ?? []) {
      try {
        await mpCancelarOrden(token, c.order_id);
      } catch {
        /* nada */
      }
      try {
        const r = estadoDeOrden(await mpOrden(token, c.order_id), Number(c.monto));
        if (r.estado !== "pendiente") await db.from("mp_cobros").update({ estado: r.estado, tipo_pago: r.tipo, pago_id: r.pagoId }).eq("id", c.id);
      } catch {
        /* nada */
      }
    }

    const orden = await mpCrearOrden(token, cuenta.external_pos_id, monto, `cs-${randomUUID()}`, `${cfg?.nombre ?? "Compra"}`);
    const { data: fila, error } = await db
      .from("mp_cobros")
      .insert({ comercio_id: perfil.comercio_id, order_id: orden.id, monto, usuario_nombre: perfil.nombre })
      .select("id")
      .single();
    if (error) throw new MpError("No se pudo registrar el cobro: " + error.message, 500);
    return Response.json({ id: fila.id, order_id: orden.id, qr_data: orden.type_response?.qr_data ?? null, qr_imagen: cuenta.qr_imagen });
  } catch (e) {
    return respuestaError(e);
  }
}

async function cobroDelComercio(comercioId: string, id: string | null) {
  if (!id) throw new MpError("Falta el id del cobro", 400);
  const { data } = await admin().from("mp_cobros").select("*").eq("id", id).eq("comercio_id", comercioId).maybeSingle();
  if (!data) throw new MpError("Cobro inexistente", 404);
  return data as { id: string; order_id: string; monto: number; estado: string; tipo_pago: string | null };
}

/** GET ?id= → consulta el estado en Mercado Pago (la caja lo llama cada pocos segundos) */
export async function GET(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req, { cualquierPlan: true });
    const cobro = await cobroDelComercio(perfil.comercio_id, new URL(req.url).searchParams.get("id"));
    if (cobro.estado !== "pendiente") return Response.json({ estado: cobro.estado, tipo_pago: cobro.tipo_pago, order_id: cobro.order_id });
    const db = admin();
    const orden = await mpOrden(await tokenComercio(db, perfil.comercio_id), cobro.order_id);
    const r = estadoDeOrden(orden, Number(cobro.monto));
    if (r.estado !== "pendiente" || r.tipo) {
      await db
        .from("mp_cobros")
        .update({ estado: r.estado, tipo_pago: r.tipo, pago_id: r.pagoId, actualizado: new Date().toISOString() })
        .eq("id", cobro.id)
        .eq("estado", "pendiente");
    }
    return Response.json({ estado: r.estado, tipo_pago: r.tipo, order_id: cobro.order_id });
  } catch (e) {
    return respuestaError(e);
  }
}

/** DELETE ?id= → cancela el cobro si todavía no se pagó */
export async function DELETE(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req, { cualquierPlan: true });
    const cobro = await cobroDelComercio(perfil.comercio_id, new URL(req.url).searchParams.get("id"));
    if (cobro.estado !== "pendiente") return Response.json({ estado: cobro.estado });
    const db = admin();
    const token = await tokenComercio(db, perfil.comercio_id);
    let cancelada = true;
    try {
      await mpCancelarOrden(token, cobro.order_id);
    } catch {
      cancelada = false; // puede que justo se haya pagado: lo vemos abajo
    }
    const r = estadoDeOrden(await mpOrden(token, cobro.order_id), Number(cobro.monto));
    if (r.estado === "pendiente" && !cancelada) {
      // no marcarlo cancelado si en MP sigue abierto: el cliente todavía podría pagarlo
      throw new MpError("Mercado Pago no permitió cancelar el cobro. Esperá a que venza (10 min) o revisá la app de MP.", 409);
    }
    const estado = r.estado === "pendiente" ? "cancelado" : r.estado;
    await db
      .from("mp_cobros")
      .update({ estado, tipo_pago: r.tipo, pago_id: r.pagoId, actualizado: new Date().toISOString() })
      .eq("id", cobro.id)
      .eq("estado", "pendiente");
    return Response.json({ estado, tipo_pago: r.tipo, order_id: cobro.order_id });
  } catch (e) {
    return respuestaError(e);
  }
}
