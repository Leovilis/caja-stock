"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, Check, Plus, Trash2, X } from "lucide-react";
import { registrarVencimiento, resolverVencimiento } from "@/lib/db";
import { errMsg } from "@/lib/supabase";
import { isoDate, number } from "@/lib/format";
import { diasParaVencer, type Producto, type Vencimiento } from "@/lib/types";
import { useVencimientos } from "@/hooks/useVencimientos";
import { Badge, Empty, Field, Modal, NumInput } from "./ui";

const dmy = (iso: string) => iso.split("-").reverse().join("/");
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function estadoVencimiento(vence: string, aviso: number): { texto: string; tono: "red" | "amber" | "slate" } {
  const d = diasParaVencer(vence);
  if (d < 0) return { texto: d === -1 ? "Venció ayer" : `Venció hace ${-d} días`, tono: "red" };
  if (d === 0) return { texto: "Vence hoy", tono: "red" };
  if (d <= aviso) return { texto: d === 1 ? "Vence mañana" : `Vence en ${d} días`, tono: "amber" };
  return { texto: `En ${d} días`, tono: "slate" };
}

/** Panel de vencimientos (página Stock) */
export function VencimientosPanel({ productos }: { productos: Producto[] }) {
  const { lista, alertas, aviso } = useVencimientos();
  const [todos, setTodos] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const visibles = todos ? lista : lista.filter((v) => diasParaVencer(v.vence) <= aviso);

  async function resolver(v: Vencimiento, accion: "vendido" | "retirar" | "borrar") {
    const nombre = v.productos?.nombre ?? "el producto";
    if (accion === "retirar" && !confirm(`¿Retirar ${number(v.cantidad)} u. de "${nombre}"?\n\nSe descuentan del stock como VENCIDO (cuenta como pérdida).`)) return;
    if (accion === "borrar" && !confirm(`¿Borrar este vencimiento de "${nombre}"? (no toca el stock)`)) return;
    try {
      await resolverVencimiento(v.id, accion);
      toast.success(accion === "vendido" ? "Marcado como vendido" : accion === "retirar" ? "Retirado del stock como vencido" : "Borrado");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="card mb-6 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock size={18} /> Vencimientos
          {alertas > 0 && <Badge tone="red">{alertas} para revisar</Badge>}
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
            Ver todos los pendientes ({lista.length})
          </label>
          <button className="btn-primary btn-sm" onClick={() => setNuevo(true)}>
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>
      {visibles.length === 0 ? (
        <Empty>
          {lista.length === 0
            ? "No hay vencimientos cargados. Cargalos al ingresar mercadería (Compras) o con «Agregar»."
            : `Nada vence en los próximos ${aviso} días 👌`}
        </Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Vence</th>
              <th>Producto</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Stock actual</th>
              <th>Origen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => {
              const e = estadoVencimiento(v.vence, aviso);
              return (
                <tr key={v.id}>
                  <td className="whitespace-nowrap">
                    <div className="font-medium">{dmy(v.vence)}</div>
                    <Badge tone={e.tono}>{e.texto}</Badge>
                  </td>
                  <td>
                    <div className="font-medium">{v.productos?.nombre ?? "—"}</div>
                    {v.productos?.codigo && <div className="font-mono text-xs text-slate-400">{v.productos.codigo}</div>}
                  </td>
                  <td className="text-right">{number(v.cantidad)}</td>
                  <td className="text-right text-slate-500">{number(v.productos?.stock ?? 0)}</td>
                  <td className="text-xs text-slate-500">{v.nota || v.usuario_nombre}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-ghost btn-sm" title="Ya no queda: se vendió" onClick={() => resolver(v, "vendido")}>
                      <Check size={14} /> Se vendió
                    </button>
                    <button className="btn-ghost btn-sm text-rose-700" title="Sacar de la góndola y descontar del stock" onClick={() => resolver(v, "retirar")}>
                      <Trash2 size={14} /> Retirar
                    </button>
                    <button className="p-1 text-slate-400 hover:text-rose-600" title="Borrar (se cargó mal)" onClick={() => resolver(v, "borrar")}>
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <NuevoVencimientoModal open={nuevo} onClose={() => setNuevo(false)} productos={productos} />
    </div>
  );
}

function NuevoVencimientoModal({ open, onClose, productos }: { open: boolean; onClose: () => void; productos: Producto[] }) {
  const [q, setQ] = useState("");
  const [prod, setProd] = useState<Producto | null>(null);
  const [vence, setVence] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const res = useMemo(() => {
    const t = norm(q.trim());
    if (!t || prod) return [];
    const exacto = productos.find((p) => p.codigo === q.trim());
    if (exacto) return [exacto];
    return productos.filter((p) => norm(`${p.nombre} ${p.codigo}`).includes(t)).slice(0, 8);
  }, [q, productos, prod]);

  const cerrar = () => {
    setQ("");
    setProd(null);
    setVence("");
    setCantidad(1);
    setNota("");
    onClose();
  };

  async function guardar() {
    if (!prod) return toast.error("Elegí el producto");
    if (!vence) return toast.error("Indicá la fecha de vencimiento");
    setGuardando(true);
    try {
      await registrarVencimiento(prod.id, vence, cantidad, nota);
      toast.success("Vencimiento cargado");
      cerrar();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={open} onClose={cerrar} title="Agregar vencimiento" size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label="Producto">
          {prod ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>{prod.nombre}</span>
              <button type="button" className="text-xs text-brand-600" onClick={() => setProd(null)}>
                cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className="input"
                placeholder="Escaneá o buscá…"
                value={q}
                autoFocus
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (res[0]) setProd(res[0]);
                  }
                }}
              />
              {res.length > 0 && (
                <div className="card absolute z-10 mt-1 w-full overflow-hidden">
                  {res.map((p) => (
                    <button type="button" key={p.id} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setProd(p)}>
                      <span>{p.nombre}</span>
                      <span className="text-slate-400">stock {number(p.stock)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vence">
            <input className="input" type="date" min={isoDate(new Date(Date.now() - 365 * 86_400_000))} value={vence} onChange={(e) => setVence(e.target.value)} />
          </Field>
          <Field label="Cantidad">
            <NumInput value={cantidad} onChange={setCantidad} />
          </Field>
        </div>
        <Field label="Nota (opcional)">
          <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: lote de la heladera" />
        </Field>
        <button className="btn-primary w-full" disabled={guardando}>
          Guardar
        </button>
      </form>
    </Modal>
  );
}
