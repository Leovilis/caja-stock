"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Inbox, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { errMsg, rpc, supabase } from "@/lib/supabase";
import { fechaHora } from "@/lib/format";
import { Badge } from "./ui";

export interface Consulta {
  id: string;
  creado: string;
  nombre: string;
  negocio: string;
  telefono: string;
  email: string;
  plan: string;
  mensaje: string;
  atendida: string | null;
  nota: string;
}

/** WhatsApp argentino: agrega 549 si escribieron el número local */
const waNumero = (t: string) => {
  let d = t.replace(/\D/g, "").replace(/^0/, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15/, "$1"); // 381 15 xxxxxxx → 381 xxxxxxx
  return `549${d}`;
};

/** Consultas que llegan desde el formulario de la página de presentación (sólo superadmin) */
export function ConsultasPanel() {
  const [lista, setLista] = useState<Consulta[]>([]);
  const [todas, setTodas] = useState(false);

  const cargar = useCallback(async () => {
    let q = supabase.from("consultas").select("*").order("creado", { ascending: false }).limit(100);
    if (!todas) q = q.is("atendida", null);
    const { data, error } = await q;
    if (error) {
      // la tabla todavía no existe (falta correr schema.sql): no molestar
      if (!/consultas/.test(error.message)) toast.error(errMsg(error));
      return;
    }
    setLista(data as Consulta[]);
  }, [todas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function marcar(c: Consulta, atendida: boolean) {
    try {
      await rpc("admin_consulta_atendida", { p_id: c.id, p_atendida: atendida, p_nota: null });
      cargar();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const pendientes = lista.filter((c) => !c.atendida).length;
  if (!todas && lista.length === 0)
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <Inbox size={16} /> No hay consultas nuevas desde la página.
        </span>
        <button className="text-xs text-brand-600 hover:underline" onClick={() => setTodas(true)}>
          Ver atendidas
        </button>
      </div>
    );

  return (
    <div className="card mb-4 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Inbox size={18} /> Consultas desde la página
          {pendientes > 0 && <Badge tone="amber">{pendientes} sin atender</Badge>}
        </h3>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Ver también las atendidas
        </label>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Quién</th>
            <th>Plan</th>
            <th>Mensaje</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id} className={c.atendida ? "opacity-50" : ""}>
              <td className="whitespace-nowrap text-xs text-slate-500">{fechaHora(c.creado)}</td>
              <td>
                <div className="font-medium">{c.nombre}</div>
                {c.negocio && <div className="text-xs text-slate-500">{c.negocio}</div>}
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {c.telefono && (
                    <a
                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      href={`https://wa.me/${waNumero(c.telefono)}?text=${encodeURIComponent(`Hola ${c.nombre.split(" ")[0]}! Te escribo de Mostrador por tu consulta.`)}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <MessageCircle size={13} /> {c.telefono}
                    </a>
                  )}
                  {c.email && (
                    <a className="inline-flex items-center gap-1 text-brand-600 hover:underline" href={`mailto:${c.email}?subject=${encodeURIComponent("Tu consulta sobre Mostrador")}`}>
                      <Mail size={13} /> {c.email}
                    </a>
                  )}
                </div>
              </td>
              <td>{c.plan && <Badge tone={c.plan === "Completo" ? "green" : c.plan === "Básico" ? "blue" : "slate"}>{c.plan}</Badge>}</td>
              <td className="max-w-xs whitespace-pre-wrap text-sm text-slate-600">{c.mensaje}</td>
              <td className="whitespace-nowrap text-right">
                {c.atendida ? (
                  <button className="btn-ghost btn-sm" onClick={() => marcar(c, false)} title="Volver a pendiente">
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <button className="btn-ghost btn-sm" onClick={() => marcar(c, true)}>
                    <Check size={14} /> Atendida
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
