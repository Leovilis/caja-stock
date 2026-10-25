import { admin, clienteUsuario, notaCreditoVenta, respuestaError, usuarioDesdeRequest } from "@/lib/arca/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;
// En Vercel corre en São Paulo: más cerca de los servidores de ARCA
export const preferredRegion = "gru1";

/**
 * POST { venta_id, motivo }
 * Si la venta está facturada, primero emite la nota de crédito en ARCA y después anula la venta
 * (devuelve el stock). Si la anulación falla, la NC queda guardada y se puede reintentar.
 */
export async function POST(req: Request) {
  try {
    const { perfil, token } = await usuarioDesdeRequest(req);
    const { venta_id, motivo } = await req.json();
    if (!venta_id || !String(motivo ?? "").trim()) return Response.json({ error: "Indicá el motivo" }, { status: 400 });

    const { data: fac } = await admin()
      .from("comprobantes")
      .select("id")
      .eq("venta_id", venta_id)
      .eq("comercio_id", perfil.comercio_id)
      .eq("clase", "factura")
      .maybeSingle();
    const nota = fac ? await notaCreditoVenta(perfil, venta_id) : null;

    const { error } = await clienteUsuario(token).rpc("anular_venta", { p_venta: venta_id, p_motivo: String(motivo).trim() });
    if (error) {
      return Response.json(
        { error: (nota ? "La nota de crédito se emitió, pero la venta no se pudo anular: " : "") + error.message, nota },
        { status: 400 }
      );
    }
    return Response.json({ ok: true, nota });
  } catch (e) {
    return respuestaError(e);
  }
}
