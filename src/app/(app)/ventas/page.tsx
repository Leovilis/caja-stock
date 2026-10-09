"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Ban, Download, Eye, Printer } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { anularVenta } from "@/lib/db";
import { money, number, fechaHora, isoDate, parseIsoDate, finDia } from "@/lib/format";
import { descargarCSV } from "@/lib/csv";
import { imprimirTicket } from "@/lib/ticket";
import type { Venta } from "@/lib/types";
import { MEDIOS_PAGO, medioLabel } from "@/lib/types";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Stat } from "@/components/ui";

export default function VentasPage() {
  const { esAdmin, config } = useApp();
  const hoy = isoDate(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [medio, setMedio] = useState("");
  const [buscar, setBuscar] = useState("");
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");

  // Los vendedores sólo ven el día de hoy
  const d = esAdmin ? desde : hoy;
  const h = esAdmin ? hasta : hoy;
  const { data: ventas, cargando } = useQuery<Venta>(
    () =>
      supabase
        .from("ventas")
        .select("*, venta_items(*)")
        .gte("fecha", parseIsoDate(d).toISOString())
        .lte("fecha", finDia(parseIsoDate(h)).toISOString())
        .order("fecha", { ascending: false }),
    ["ventas"],
    `${d}-${h}`
  );

  const lista = ventas.filter(
    (v) =>
      (!medio || v.pagos.some((p) => p.medio === medio)) &&
      (!buscar || String(v.numero) === buscar.trim() || v.venta_items.some((i) => i.nombre.toLowerCase().includes(buscar.toLowerCase())))
  );
  const ok = lista.filter((v) => v.estado === "completada");
  const total = ok.reduce((a, v) => a + Number(v.total), 0);

  async function anular() {
    if (!detalle) return;
    if (!motivo.trim()) return toast.error("Indicá el motivo");
    try {
      await anularVenta(detalle.id, motivo.trim());
      toast.success(`Venta #${detalle.numero} anulada. Stock devuelto.`);
      setDetalle(null);
      setMotivo("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="Ventas" subtitle={esAdmin ? "Historial de tickets" : "Tickets de hoy"}>
        {esAdmin && (
          <>
            <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <button
              className="btn-ghost"
              onClick={() =>
                descargarCSV(
                  `ventas-${d}_${h}`,
                  lista.flatMap((v) =>
                    v.venta_items.map((i) => ({
                      numero: v.numero,
                      fecha: fechaHora(v.fecha),
                      estado: v.estado,
                      vendedor: v.usuario_nombre,
                      producto: i.nombre,
                      codigo: i.codigo,
                      categoria: i.categoria,
                      cantidad: i.cantidad,
                      precio: String(i.precio).replace(".", ","),
                      subtotal: String(i.subtotal).replace(".", ","),
                      costo: String(i.costo * i.cantidad).replace(".", ","),
                      total_ticket: String(v.total).replace(".", ","),
                      pagos: v.pagos.map((p) => `${medioLabel(p.medio)} ${p.monto}`).join(" + "),
                    }))
                  )
                )
              }
            >
              <Download size={16} /> CSV
            </button>
          </>
        )}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Total" value={money(total)} tone="blue" />
        <Stat label="Tickets" value={ok.length} hint={lista.length - ok.length ? `${lista.length - ok.length} anuladas` : undefined} />
        <Stat label="Ticket promedio" value={money(ok.length ? total / ok.length : 0)} />
      </div>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap gap-2 p-3">
          <input className="input max-w-xs" placeholder="N° de ticket o producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select className="input w-auto" value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value="">Todos los medios</option>
            {MEDIOS_PAGO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {cargando ? (
          <Loading />
        ) : lista.length === 0 ? (
          <Empty>No hay ventas</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Detalle</th>
                <th>Pago</th>
                <th>Vendedor</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} className={v.estado === "anulada" ? "text-slate-400 line-through" : ""}>
                  <td className="font-mono text-xs">#{v.numero}</td>
                  <td className="whitespace-nowrap text-xs">{fechaHora(v.fecha)}</td>
                  <td className="max-w-xs truncate text-sm">{v.venta_items.map((i) => `${number(i.cantidad)}× ${i.nombre}`).join(", ")}</td>
                  <td className="text-xs">{v.pagos.map((p) => medioLabel(p.medio)).join(" + ")}</td>
                  <td className="text-xs">{v.usuario_nombre}</td>
                  <td className="text-right font-semibold tabular-nums">{money(v.total)}</td>
                  <td className="whitespace-nowrap no-underline">
                    <button className="p-1 text-slate-400 hover:text-brand-600" onClick={() => setDetalle(v)}>
                      <Eye size={16} />
                    </button>
                    <button className="p-1 text-slate-400 hover:text-brand-600" onClick={() => imprimirTicket(v, config)}>
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Ticket #${detalle?.numero ?? ""}`} size="md">
        {detalle && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-slate-500">
              <span>{fechaHora(detalle.fecha)}</span>
              <span>{detalle.usuario_nombre}</span>
            </div>
            {detalle.estado === "anulada" && (
              <div className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">
                Anulada por {detalle.anulada_por}: {detalle.motivo_anulacion}
              </div>
            )}
            <table className="table">
              <tbody>
                {detalle.venta_items.map((i, k) => (
                  <tr key={k}>
                    <td>
                      {number(i.cantidad)} × {i.nombre}
                    </td>
                    <td className="text-right">{money(i.subtotal)}</td>
                  </tr>
                ))}
                {detalle.descuento > 0 && (
                  <tr>
                    <td>Descuento</td>
                    <td className="text-right text-rose-600">-{money(detalle.descuento)}</td>
                  </tr>
                )}
                <tr className="font-bold">
                  <td>Total</td>
                  <td className="text-right">{money(detalle.total)}</td>
                </tr>
                {detalle.pagos.map((p, k) => (
                  <tr key={"p" + k} className="text-sm text-slate-500">
                    <td>{medioLabel(p.medio)}</td>
                    <td className="text-right">{money(p.monto)}</td>
                  </tr>
                ))}
                {esAdmin && (
                  <tr className="text-sm text-slate-500">
                    <td>Ganancia bruta</td>
                    <td className="text-right">{money(detalle.total - detalle.costo_total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => imprimirTicket(detalle, config)}>
                <Printer size={16} /> Reimprimir
              </button>
              <Badge tone={detalle.estado === "anulada" ? "red" : "green"}>{detalle.estado}</Badge>
            </div>
            {esAdmin && detalle.estado === "completada" && (
              <div className="rounded-lg border border-rose-200 p-3">
                <Field label="Anular venta (devuelve el stock)">
                  <input className="input" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </Field>
                <button className="btn-danger mt-2 w-full" onClick={anular}>
                  <Ban size={16} /> Anular
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
