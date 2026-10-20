import { facturarVenta, respuestaError, usuarioDesdeRequest } from "@/lib/arca/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;
// En Vercel corre en São Paulo: más cerca de los servidores de ARCA
export const preferredRegion = "gru1";

/** POST { venta_id, receptor: { docTipo, docNro, condicion, nombre?, domicilio? } } */
export async function POST(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req);
    const body = await req.json();
    if (!body?.venta_id) return Response.json({ error: "Falta venta_id" }, { status: 400 });
    const comprobante = await facturarVenta(perfil, String(body.venta_id), body.receptor ?? { docTipo: 99, docNro: 0, condicion: 5 });
    return Response.json({ comprobante });
  } catch (e) {
    return respuestaError(e);
  }
}
