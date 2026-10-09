"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { borrarGasto, registrarGasto } from "@/lib/db";
import { money, fecha, isoDate, inicioMes } from "@/lib/format";
import { descargarCSV } from "@/lib/csv";
import type { Gasto, MedioPago } from "@/lib/types";
import { MEDIOS_PAGO, medioLabel } from "@/lib/types";
import { Empty, Field, Modal, NumInput, PageHeader, Stat } from "@/components/ui";

export default function GastosPage() {
  const { config } = useApp();
  const [desde, setDesde] = useState(isoDate(inicioMes()));
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [cat, setCat] = useState("");
  const [nuevo, setNuevo] = useState(false);

  const { data: gastos } = useQuery<Gasto>(
    () => supabase.from("gastos").select("*").gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }).order("creado", { ascending: false }),
    ["gastos"],
    `${desde}-${hasta}`
  );

  const filtrados = gastos.filter((g) => !cat || g.categoria === cat);
  const total = filtrados.reduce((a, g) => a + Number(g.monto), 0);
  const porCat = useMemo(() => {
    const m: Record<string, number> = {};
    gastos.forEach((g) => (m[g.categoria] = (m[g.categoria] ?? 0) + Number(g.monto)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [gastos]);
  const totalGeneral = gastos.reduce((a, g) => a + Number(g.monto), 0);

  async function borrar(g: Gasto) {
    if (g.caja_id) return toast.error("Este gasto salió de la caja; no se puede borrar desde acá para no descuadrar el arqueo");
    if (!confirm(`¿Eliminar gasto de ${money(g.monto)}?`)) return;
    try {
      await borrarGasto(g.id);
      toast.success("Eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Gastos operativos del negocio (no incluye compras de mercadería)">
        <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button
          className="btn-ghost"
          onClick={() =>
            descargarCSV(
              "gastos",
              filtrados.map((g) => ({ fecha: fecha(g.fecha), categoria: g.categoria, descripcion: g.descripcion, medio: medioLabel(g.medio), monto: String(g.monto).replace(".", ",") }))
            )
          }
        >
          <Download size={16} /> CSV
        </button>
        <button className="btn-primary" onClick={() => setNuevo(true)}>
          <Plus size={16} /> Nuevo gasto
        </button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <div className="flex items-center gap-2 p-3">
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {config.categorias_gasto.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="ml-auto text-sm text-slate-500">
              Total: <b className="text-slate-900">{money(total)}</b>
            </span>
          </div>
          {filtrados.length === 0 ? (
            <Empty>Sin gastos en el período</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Medio</th>
                  <th className="text-right">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.fecha)}</td>
                    <td>{g.categoria}</td>
                    <td className="text-slate-600">
                      {g.descripcion}
                      {g.caja_id && <span className="ml-1 text-xs text-slate-400">(desde caja)</span>}
                    </td>
                    <td>{medioLabel(g.medio)}</td>
                    <td className="text-right font-medium tabular-nums">{money(g.monto)}</td>
                    <td>
                      <button className="text-slate-400 hover:text-rose-600" onClick={() => borrar(g)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-3">
          <Stat label="Gastos del período" value={money(totalGeneral)} tone="red" />
          <div className="card p-4">
            <h3 className="mb-3 font-semibold">Por categoría</h3>
            {porCat.length === 0 && <div className="text-sm text-slate-400">—</div>}
            {porCat.map(([c, v]) => (
              <div key={c} className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>{c}</span>
                  <span className="tabular-nums">{money(v)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-100">
                  <div className="h-1.5 rounded bg-rose-400" style={{ width: `${(v / totalGeneral) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <NuevoGastoModal open={nuevo} onClose={() => setNuevo(false)} />
    </div>
  );
}

function NuevoGastoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, caja } = useApp();
  const [f, setF] = useState({ fecha: isoDate(new Date()), categoria: "", descripcion: "", monto: 0, medio: "transferencia" as MedioPago, desdeCaja: false });
  const [guardando, setGuardando] = useState(false);
  const puedeCaja = !!caja && f.medio === "efectivo";

  async function guardar() {
    if (f.monto <= 0) return toast.error("Ingresá el monto");
    setGuardando(true);
    try {
      await registrarGasto({
        fecha: f.fecha,
        categoria: f.categoria || config.categorias_gasto[0],
        descripcion: f.descripcion,
        monto: f.monto,
        medio: f.medio,
        desdeCaja: puedeCaja && f.desdeCaja,
      });
      toast.success("Gasto registrado");
      setF({ ...f, descripcion: "", monto: 0 });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo gasto">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label="Fecha">
          <input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        <Field label="Monto">
          <NumInput value={f.monto} onChange={(n) => setF({ ...f, monto: n })} autoFocus placeholder="0" />
        </Field>
        <Field label="Categoría">
          <select className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {config.categorias_gasto.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Medio de pago">
          <select className="input" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value as MedioPago })}>
            {MEDIOS_PAGO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <input className="input" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej: factura EJESA septiembre" />
        </Field>
        <label className={`flex items-center gap-2 text-sm sm:col-span-2 ${puedeCaja ? "" : "opacity-40"}`}>
          <input type="checkbox" disabled={!puedeCaja} checked={puedeCaja && f.desdeCaja} onChange={(e) => setF({ ...f, desdeCaja: e.target.checked })} />
          Sale del efectivo de la caja abierta (se registra como egreso de caja)
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={guardando}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
