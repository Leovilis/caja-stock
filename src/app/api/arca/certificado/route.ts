import { infoCertificado } from "@/lib/arca/servicio";
import { admin, configFiscal, credencialesComercio, guardarCredenciales, respuestaError, usuarioDesdeRequest } from "@/lib/arca/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Datos del certificado cargado (nunca devuelve la clave) */
export async function GET(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req);
    if (perfil.rol !== "admin") return Response.json({ error: "Sólo administradores" }, { status: 403 });
    const db = admin();
    const cfg = await configFiscal(db, perfil.comercio_id).catch(() => null);
    try {
      const c = infoCertificado(await credencialesComercio(db, perfil.comercio_id, cfg?.cuit ?? ""));
      return Response.json({ cargado: true, cn: c.cn, cuit: c.cuit, vence: c.vence, corresponde: c.corresponde });
    } catch {
      return Response.json({ cargado: false });
    }
  } catch (e) {
    return respuestaError(e);
  }
}

/** POST { cert, key }: valida y guarda el certificado del comercio cifrado en Supabase Vault (sólo administradores) */
export async function POST(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req);
    if (perfil.rol !== "admin") return Response.json({ error: "Sólo administradores" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const pem = { cert: String(body.cert ?? "").trim(), key: String(body.key ?? "").trim() };
    if (!pem.cert || !pem.key) return Response.json({ error: "Cargá el certificado y la clave privada" }, { status: 400 });
    if (pem.cert.length > 20_000 || pem.key.length > 20_000) return Response.json({ error: "Archivo demasiado grande" }, { status: 400 });

    const c = infoCertificado(pem); // valida formato
    if (!c.corresponde) return Response.json({ error: "La clave privada no corresponde a este certificado" }, { status: 400 });
    if (new Date(c.vence).getTime() < Date.now()) return Response.json({ error: `El certificado venció el ${c.vence.slice(0, 10)}` }, { status: 400 });

    await guardarCredenciales(admin(), perfil.comercio_id, pem);
    return Response.json({ ok: true, cn: c.cn, cuit: c.cuit, vence: c.vence });
  } catch (e) {
    return respuestaError(e);
  }
}
