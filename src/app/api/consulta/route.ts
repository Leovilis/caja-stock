// Recibe las consultas del formulario de la página de presentación. SÓLO SERVIDOR.
// Guarda en la tabla `consultas` (la ve el superadmin en Clientes) y, si está configurado,
// avisa por email con Resend (RESEND_API_KEY + AVISO_CONSULTAS_EMAIL).
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { admin } from "@/lib/arca/servidor";

export const dynamic = "force-dynamic";

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function avisarPorEmail(c: Record<string, string>) {
  const key = process.env.RESEND_API_KEY?.trim();
  const para = process.env.AVISO_CONSULTAS_EMAIL?.trim();
  if (!key || !para) return;
  const filas = Object.entries({ Nombre: c.nombre, Negocio: c.negocio, WhatsApp: c.telefono, Email: c.email, Plan: c.plan, Mensaje: c.mensaje })
    .filter(([, v]) => v)
    .map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`)
    .join("");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AVISO_CONSULTAS_DESDE?.trim() || "Mostrador <onboarding@resend.dev>",
        to: [para],
        reply_to: c.email || undefined,
        subject: `Nueva consulta: ${c.nombre}${c.negocio ? ` (${c.negocio})` : ""}`,
        html: filas,
      }),
    });
  } catch {
    /* el aviso es opcional: la consulta ya quedó guardada */
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // trampa para robots: campo oculto que una persona nunca completa
  if (txt(body.web, 200)) return NextResponse.json({ ok: true });

  const c = {
    nombre: txt(body.nombre, 120),
    negocio: txt(body.negocio, 120),
    telefono: txt(body.telefono, 40),
    email: txt(body.email, 160).toLowerCase(),
    plan: txt(body.plan, 40),
    mensaje: typeof body.mensaje === "string" ? body.mensaje.trim().slice(0, 2000) : "",
  };
  if (!c.nombre) return NextResponse.json({ error: "Escribí tu nombre" }, { status: 400 });
  if (!c.telefono && !c.email) return NextResponse.json({ error: "Dejanos un WhatsApp o un email para responderte" }, { status: 400 });
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return NextResponse.json({ error: "Revisá el email" }, { status: 400 });
  if (c.telefono && c.telefono.replace(/\D/g, "").length < 8) return NextResponse.json({ error: "Revisá el número de WhatsApp" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const origen = createHash("sha256").update(`consulta:${ip}`).digest("hex").slice(0, 24);

  try {
    const db = admin();
    const hace1h = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("consultas").select("id", { count: "exact", head: true }).eq("origen", origen).gte("creado", hace1h);
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "Ya recibimos tus consultas. Te respondemos a la brevedad." }, { status: 429 });

    const { error } = await db.from("consultas").insert({ ...c, origen });
    if (error) throw error;
  } catch (e) {
    console.error("consulta:", e);
    return NextResponse.json({ error: "No pudimos enviar la consulta. Probá de nuevo en un rato." }, { status: 500 });
  }

  await avisarPorEmail(c);
  return NextResponse.json({ ok: true });
}
