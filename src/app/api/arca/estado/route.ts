import { TIPO_CBTE } from "@/lib/arca/calculo";
import { feDummy, infoCertificado, ultimoAutorizado } from "@/lib/arca/servicio";
import { admin, configFiscal, credencialesComercio, obtenerTA, respuestaError, usuarioDesdeRequest, type ConfigFiscal } from "@/lib/arca/servidor";
import type { CredencialesPem } from "@/lib/arca/servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;
// En Vercel corre en São Paulo: más cerca de los servidores de ARCA
export const preferredRegion = "gru1";

/** Diagnóstico paso a paso de la conexión con ARCA (sólo administradores) */
export async function GET(req: Request) {
  try {
    const { perfil } = await usuarioDesdeRequest(req);
    if (perfil.rol !== "admin") return Response.json({ error: "Sólo administradores" }, { status: 403 });
    const pasos: { paso: string; ok: boolean; detalle: string }[] = [];
    const paso = async (nombre: string, fn: () => Promise<string>) => {
      try {
        pasos.push({ paso: nombre, ok: true, detalle: await fn() });
        return true;
      } catch (e) {
        pasos.push({ paso: nombre, ok: false, detalle: (e as Error).message });
        return false;
      }
    };
    const db = admin();
    const ref: { cfg: ConfigFiscal | null; pem: CredencialesPem | null } = { cfg: null, pem: null };
    const ok1 = await paso("Datos fiscales", async () => {
      const cfg = await configFiscal(db, perfil.comercio_id);
      ref.cfg = cfg;
      return `${cfg.razonSocial} · CUIT ${cfg.cuit} · PV ${cfg.puntoVenta} · ${cfg.condicion === "monotributo" ? "Monotributo" : "Responsable Inscripto"} · ${cfg.ambiente}`;
    });
    const ok2 = await paso("Certificado digital", async () => {
      if (!ref.cfg) throw new Error("Primero completá los datos fiscales");
      const pem = await credencialesComercio(db, perfil.comercio_id, ref.cfg.cuit);
      const c = infoCertificado(pem);
      ref.pem = pem;
      const dias = Math.floor((new Date(c.vence).getTime() - Date.now()) / 86400000);
      if (dias < 0) throw new Error(`Vencido el ${c.vence.slice(0, 10)}`);
      if (!c.corresponde) throw new Error("La clave privada no corresponde a este certificado");
      if (c.cuit && c.cuit !== ref.cfg.cuit) throw new Error(`El certificado es del CUIT ${c.cuit}, pero el emisor configurado es ${ref.cfg.cuit}`);
      return `${c.cn} ${c.serialNumber ? "· " + c.serialNumber : ""} · vence en ${dias} días`;
    });
    if (ok1 && ref.cfg) {
      const c = ref.cfg;
      await paso("Servidores de ARCA", async () => {
        const d = await feDummy(c.ambiente);
        if ([d.app, d.db, d.auth].some((x) => x !== "OK")) throw new Error(`App ${d.app} · DB ${d.db} · Auth ${d.auth}`);
        return "Funcionando";
      });
      if (ok2 && ref.pem) {
        const okTa = await paso("Autenticación (WSAA)", async () => {
          const ta = await obtenerTA(db, c.ambiente, c.cuit, ref.pem!);
          return `Ticket vigente hasta ${ta.expira.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`;
        });
        if (okTa) {
          await paso("Punto de venta y numeración", async () => {
            const ta = await obtenerTA(db, c.ambiente, c.cuit, ref.pem!);
            const letras = c.condicion === "monotributo" ? (["C"] as const) : (["A", "B"] as const);
            const partes: string[] = [];
            for (const l of letras) {
              const n = await ultimoAutorizado(c.ambiente, ta, c.cuit, c.puntoVenta, TIPO_CBTE.factura[l]);
              partes.push(`Factura ${l}: último N° ${n}`);
            }
            return partes.join(" · ");
          });
        }
      }
    }
    return Response.json({ ok: pasos.every((p) => p.ok), pasos });
  } catch (e) {
    return respuestaError(e);
  }
}
