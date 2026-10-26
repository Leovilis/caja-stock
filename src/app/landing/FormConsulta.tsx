"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { MARCA, linkWhatsApp } from "@/lib/marca";

const PLANES = ["Prueba gratis", "Básico", "Completo", "No sé todavía"];
/** cada botón de la página lleva a #probar, #plan-basico o #plan-completo y deja el plan elegido */
const DESDE_HASH: Record<string, string> = { "#probar": "Prueba gratis", "#plan-basico": "Básico", "#plan-completo": "Completo" };

export function FormConsulta() {
  const [f, setF] = useState({ nombre: "", negocio: "", telefono: "", email: "", plan: "Prueba gratis", mensaje: "", web: "" });
  const [estado, setEstado] = useState<"" | "enviando" | "ok">("");
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const leer = () => {
      const p = DESDE_HASH[window.location.hash];
      if (p) setF((x) => ({ ...x, plan: p }));
    };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.telefono.trim() && !f.email.trim()) return setError("Dejanos un WhatsApp o un email para responderte.");
    setEstado("enviando");
    try {
      const r = await fetch("/api/consulta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No pudimos enviar la consulta.");
      setEstado("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar la consulta.");
      setEstado("");
    }
  }

  const campo = "w-full border-0 border-b-2 border-dashed border-black/25 bg-transparent px-0 py-2 text-base outline-none placeholder:text-black/35 focus:border-black";

  if (estado === "ok")
    return (
      <div className="bg-white px-7 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16130F] text-white">
          <Check size={28} />
        </div>
        <h3 className="mt-4 text-3xl font-extrabold">¡Recibido!</h3>
        <p className="mx-auto mt-2 max-w-xs opacity-70">
          Gracias, {f.nombre.split(" ")[0]}. Te escribimos {f.telefono ? "por WhatsApp" : "por email"} a la brevedad.
        </p>
      </div>
    );

  return (
    <form onSubmit={enviar} className="bg-white px-6 py-6 text-left sm:px-7">
      <div className="mono flex justify-between text-xs uppercase tracking-widest opacity-60">
        <span>Nota de pedido</span>
        <span>{MARCA.dominio}</span>
      </div>
      <h3 className="mt-1 text-3xl font-extrabold">Pedí tu prueba o el precio</h3>

      <div className="mono mt-5 text-[11px] font-bold uppercase tracking-widest opacity-60">Me interesa</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLANES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setF((x) => ({ ...x, plan: p }))}
            className={`rounded-full border-2 border-[#16130F] px-3 py-1 text-sm font-semibold transition ${f.plan === p ? "bg-[#16130F] text-white" : "hover:bg-black/5"}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-x-5 sm:grid-cols-2">
        <input className={campo} placeholder="Tu nombre *" value={f.nombre} onChange={set("nombre")} required maxLength={120} autoComplete="name" />
        <input className={campo} placeholder="Nombre del negocio" value={f.negocio} onChange={set("negocio")} maxLength={120} autoComplete="organization" />
        <input className={campo} placeholder="WhatsApp" value={f.telefono} onChange={set("telefono")} maxLength={40} inputMode="tel" autoComplete="tel" />
        <input className={campo} placeholder="Email" type="email" value={f.email} onChange={set("email")} maxLength={160} autoComplete="email" />
      </div>
      <textarea className={`${campo} mt-1 resize-none`} rows={2} placeholder="¿Algo que quieras contarnos? (rubro, cuántas cajas…)" value={f.mensaje} onChange={set("mensaje")} maxLength={2000} />
      {/* trampa anti-robots: invisible para personas */}
      <input type="text" name="web" value={f.web} onChange={set("web")} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && <p className="mt-3 rounded bg-[#FF5B1F]/10 px-3 py-2 text-sm font-medium text-[#B83A0E]">{error}</p>}

      <button
        disabled={estado === "enviando"}
        className="mt-5 flex w-full items-center justify-between rounded-full bg-[#16130F] py-3 pl-6 pr-3 text-lg font-semibold text-white disabled:opacity-60"
      >
        {estado === "enviando" ? "Enviando…" : "Enviar"}
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF5B1F]">
          <ArrowRight size={18} />
        </span>
      </button>
      <p className="mono mt-2 text-center text-[11px] opacity-50">Te respondemos el mismo día. Sin compromiso.</p>

      {MARCA.whatsapp && (
        <a
          href={linkWhatsApp(`Hola! Me interesa Mostrador${f.plan && f.plan !== "No sé todavía" ? ` (${f.plan})` : ""}.`)}
          target="_blank"
          rel="noopener"
          className="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-[#16130F] py-2.5 font-semibold hover:bg-black/5"
        >
          <MessageCircle size={18} /> O escribinos directo por WhatsApp
        </a>
      )}
    </form>
  );
}
