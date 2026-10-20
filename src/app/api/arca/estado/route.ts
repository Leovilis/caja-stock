import { TIPO_CBTE } from "@/lib/arca/calculo";
import { feDummy, infoCertificado, ultimoAutorizado } from "@/lib/arca/servicio";
import { admin, configFiscal, obtenerTA, respuestaError, usuarioDesdeRequest, type ConfigFiscal } from "@/lib/arca/servidor";

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
    const ref: { cfg: ConfigFiscal | null } = { cfg: null };
    const ok1 = await paso("Datos fiscales", async () => {
      const cfg = await configFiscal(db);
      ref.cfg = cfg;
      return `${cfg.razonSocial} · CUIT ${cfg.cuit} · PV ${cfg.puntoVenta} · ${cfg.condicion === "monotributo" ? "Monotributo" : "Responsable Inscripto"} · ${cfg.ambiente}`;
    });
    const ok2 = await paso("Certificado digital", async () => {
      const c = infoCertificado();
      const dias = Math.floor((new Date(c.vence).getTime() - Date.now()) / 86400000);
      if (dias < 0) throw new Error(`Vencido el ${c.vence.slice(0, 10)}`);
      return `${c.cn} ${c.serialNumber ? "· " + c.serialNumber : ""} · vence en ${dias} días`;
    });
    if (ok1 && ref.cfg) {
      const c = ref.cfg;
      await paso("Servidores de ARCA", async () => {
        const d = await feDummy(c.ambiente);
        if ([d.app, d.db, d.auth].some((x) => x !== "OK")) throw new Error(`App ${d.app} · DB ${d.db} · Auth ${d.auth}`);
        return "Funcionando";
      });
      if (ok2) {
        const okTa = await paso("Autenticación (WSAA)", async () => {
          const ta = await obtenerTA(db, c.ambiente, c.cuit);
          return `Ticket vigente hasta ${ta.expira.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`;
        });
        if (okTa) {
          await paso("Punto de venta y numeración", async () => {
            const ta = await obtenerTA(db, c.ambiente, c.cuit);
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
