"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Ban, Download, Eye, FileCheck2, Printer } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { anularVenta } from "@/lib/db";
import { money, number, fechaHora, isoDate, parseIsoDate, finDia } from "@/lib/format";
import { descargarCSV } from "@/lib/csv";
import { imprimirComprobante, imprimirTicket } from "@/lib/ticket";
import { anularConNotaCredito } from "@/lib/arca/cliente";
import { nombreCbte, numeroCbte } from "@/lib/arca/calculo";
import { FacturarModal } from "@/components/FacturarModal";
import { FiltroFacturaSelector, useFiltroFactura } from "@/components/FiltroFactura";
import { pasaFiltro, ventaConFactura } from "@/lib/fiscal";
import type { Comprobante, Venta } from "@/lib/types";
import { medioLabel, mediosDe } from "@/lib/types";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Stat } from "@/components/ui";

export default function VentasPage() {
  const { esAdmin, config, modulo } = useApp();
  const conFacturacion = modulo("facturacion");
  const hoy = isoDate(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [medio, setMedio] = useState("");
  const [buscar, setBuscar] = useState("");
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");
  const [facturando, setFacturando] = useState<Venta | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [filtroGuardado, setFiltro] = useFiltroFactura();
  const filtro = esAdmin && conFacturacion ? filtroGuardado : "ambas";

  // Los vendedores sólo ven el día de hoy
  const d = esAdmin ? desde : hoy;
  const h = esAdmin ? hasta : hoy;
  const { data: ventas, cargando } = useQuery<Venta>(
    () =>
      supabase
        .from("ventas")
        .select("*, venta_items(*), comprobantes(*)")
        .gte("fecha", parseIsoDate(d).toISOString())
        .lte("fecha", finDia(parseIsoDate(h)).toISOString())
        .order("fecha", { ascending: false }),
    ["ventas", "comprobantes"],
    `${d}-${h}`
  );

  const lista = ventas.filter(
    (v) =>
      (!medio || v.pagos.some((p) => p.medio === medio)) &&
      pasaFiltro(ventaConFactura(v), filtro) &&
      (!buscar || String(v.numero) === buscar.trim() || v.venta_items.some((i) => i.nombre.toLowerCase().includes(buscar.toLowerCase())))
  );
  const ok = lista.filter((v) => v.estado === "completada");
  const total = ok.reduce((a, v) => a + Number(v.total), 0);

  async function anular() {
    if (!detalle) return;
    if (!motivo.trim()) return toast.error("Indicá el motivo");
    const fac = facturaDe(detalle);
    if (fac && !confirm(`La venta tiene ${nombreCbte("factura", fac.letra)} ${numeroCbte(fac.punto_venta, fac.numero)}. Se va a emitir una Nota de Crédito en ARCA y después se anula la venta. ¿Continuar?`)) return;
    setAnulando(true);
    try {
      if (fac) {
        const r = await anularConNotaCredito(detalle.id, motivo.trim());
        if (r.nota) {
          toast.success(`Nota de crédito ${r.nota.letra} N° ${r.nota.numero} emitida · CAE ${r.nota.cae}`, { duration: 6000 });
          await imprimirComprobante(detalle, r.nota, config, fac);
        }
      } else {
        await anularVenta(detalle.id, motivo.trim());
      }
      toast.success(`Venta #${detalle.numero} anulada. Stock devuelto.`);
      setDetalle(null);
      setMotivo("");
    } catch (e) {
      toast.error((e as Error).message, { duration: 10000 });
    } finally {
      setAnulando(false);
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
                      factura: (() => {
                        const f = facturaDe(v);
                        return f ? `${nombreCbte("factura", f.letra)} ${numeroCbte(f.punto_venta, f.numero)}` : "";
                      })(),
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
        <div className="flex flex-wrap items-center gap-2 p-3">
          {esAdmin && conFacturacion && <FiltroFacturaSelector value={filtro} onChange={setFiltro} />}
          <input className="input max-w-xs" placeholder="N° de ticket o producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <select className="input w-auto" value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value="">Todos los medios</option>
            {mediosDe(config).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
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
                  <td className="font-mono text-xs">
                    #{v.numero}
                    {facturaDe(v) && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 font-sans text-[10px] font-semibold text-emerald-700 no-underline" title="Facturada">
                        F{facturaDe(v)!.letra}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">{fechaHora(v.fecha)}</td>
                  <td className="max-w-xs truncate text-sm">{v.venta_items.map((i) => `${number(i.cantidad)}× ${i.nombre}`).join(", ")}</td>
                  <td className="text-xs">{v.pagos.map((p) => p.nombre ?? medioLabel(p.medio)).join(" + ")}</td>
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
                    <td>{p.nombre ?? medioLabel(p.medio)}</td>
                    <td className="text-right">{money(p.monto)}</td>
                  </tr>
                ))}
                {!!detalle.recargo && (
                  <tr className="text-sm text-slate-500">
                    <td>{Number(detalle.recargo) > 0 ? "Incluye recargo" : "Incluye descuento"} por medio de pago</td>
                    <td className="text-right">{money(detalle.recargo)}</td>
                  </tr>
                )}
                {esAdmin && !!detalle.comision && (
                  <tr className="text-sm text-slate-500">
                    <td>Comisión de cobro (estimada)</td>
                    <td className="text-right">-{money(detalle.comision)}</td>
                  </tr>
                )}
                {esAdmin && (
                  <tr className="text-sm text-slate-500">
                    <td>Ganancia</td>
                    <td className="text-right">{money(detalle.total - detalle.costo_total - Number(detalle.comision || 0))}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => imprimirTicket(detalle, config)}>
                <Printer size={16} /> Reimprimir ticket
              </button>
              <Badge tone={detalle.estado === "anulada" ? "red" : "green"}>{detalle.estado}</Badge>
            </div>
            {(detalle.comprobantes ?? []).length > 0 && (
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                {[...(detalle.comprobantes ?? [])]
                  .sort((a, b) => (a.clase === "factura" ? -1 : 1) - (b.clase === "factura" ? -1 : 1))
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <div className="font-semibold">
                          {nombreCbte(c.clase, c.letra)} {numeroCbte(c.punto_venta, c.numero)}
                          {c.ambiente === "homologacion" && <span className="ml-1 text-xs font-normal text-amber-700">(prueba)</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          CAE {c.cae} · {c.doc_tipo === 99 ? "Consumidor final" : `${c.receptor_nombre || "Doc."} ${c.doc_nro}`}
                        </div>
                      </div>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() =>
                          imprimirComprobante(detalle, c, config, c.asociado_id ? (detalle.comprobantes ?? []).find((x) => x.id === c.asociado_id) : null)
                        }
                      >
                        <Printer size={14} /> Imprimir
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {conFacturacion && detalle.estado === "completada" && !facturaDe(detalle) && (
              <button className="btn-primary w-full" onClick={() => setFacturando(detalle)}>
                <FileCheck2 size={16} /> Facturar (ARCA)
              </button>
            )}
            {esAdmin && detalle.estado === "completada" && (
              <div className="rounded-lg border border-rose-200 p-3">
                <Field label={facturaDe(detalle) ? "Anular venta (emite nota de crédito y devuelve el stock)" : "Anular venta (devuelve el stock)"}>
                  <input className="input" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </Field>
                <button className="btn-danger mt-2 w-full" onClick={anular} disabled={anulando}>
                  <Ban size={16} /> {anulando ? "Procesando…" : "Anular"}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <FacturarModal
        venta={facturando}
        onClose={() => setFacturando(null)}
        onListo={(c) => setDetalle((d) => (d && d.id === c.venta_id ? { ...d, comprobantes: [...(d.comprobantes ?? []), c] } : d))}
      />
    </div>
  );
}

const facturaDe = (v: Venta): Comprobante | undefined => (v.comprobantes ?? []).find((c) => c.clase === "factura");
