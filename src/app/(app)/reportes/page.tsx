"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { money, number, pct, isoDate, parseIsoDate, finDia, inicioMes } from "@/lib/format";
import { analizarVentas, DIAS_SEMANA, serieDiaria, totalGastos } from "@/lib/stats";
import { descargarCSV } from "@/lib/csv";
import type { Compra, Gasto, Venta } from "@/lib/types";
import { medioLabel } from "@/lib/types";
import { Empty, Loading, PageHeader, Stat } from "@/components/ui";
import { FiltroFacturaSelector, useFiltroFactura } from "@/components/FiltroFactura";
import { etiquetaFiltro, filtrarCompras, filtrarVentas, ventaConFactura } from "@/lib/fiscal";

const COLORES = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const tickMoney = (v: number) => (v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`);

type Orden = "cantidad" | "total" | "ganancia";

export default function ReportesPage() {
  const hoy = new Date();
  const [desde, setDesde] = useState(isoDate(inicioMes()));
  const [hasta, setHasta] = useState(isoDate(hoy));
  const [orden, setOrden] = useState<Orden>("total");
  const dDesde = parseIsoDate(desde);
  const dHasta = finDia(parseIsoDate(hasta));
  const key = `${desde}-${hasta}`;
  const ini = dDesde.toISOString();
  const fin = dHasta.toISOString();

  const [filtro, setFiltro] = useFiltroFactura();
  const { data: ventasTodas, cargando } = useQuery<Venta>(
    () => supabase.from("ventas").select("*, venta_items(*), comprobantes(id, clase, letra)").gte("fecha", ini).lte("fecha", fin),
    ["ventas", "comprobantes"],
    key
  );
  const { data: gastos } = useQuery<Gasto>(() => supabase.from("gastos").select("*").gte("fecha", desde).lte("fecha", hasta), ["gastos"], key);
  const { data: comprasTodas } = useQuery<Compra>(() => supabase.from("compras").select("*").gte("fecha", ini).lte("fecha", fin), ["compras"], key);
  const ventas = useMemo(() => filtrarVentas(ventasTodas, filtro), [ventasTodas, filtro]);
  const compras = useMemo(() => filtrarCompras(comprasTodas, filtro), [comprasTodas, filtro]);
  const ventasConFactura = useMemo(
    () => ventasTodas.filter((v) => v.estado === "completada" && ventaConFactura(v)).reduce((a, v) => a + Number(v.total), 0),
    [ventasTodas]
  );
  const totalTodas = ventasTodas.filter((v) => v.estado === "completada").reduce((a, v) => a + Number(v.total), 0);
  const pctConFactura = totalTodas > 0 ? (ventasConFactura / totalTodas) * 100 : 0;

  const r = useMemo(() => analizarVentas(ventas), [ventas]);
  const serie = useMemo(() => serieDiaria(dDesde, dHasta, r.porDia), [r, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const gTotal = totalGastos(gastos);
  const cTotal = compras.reduce((a, c) => a + Number(c.total), 0);
  const neto = r.ganancia - gTotal;

  const productos = useMemo(() => [...r.productos].sort((a, b) => b[orden] - a[orden]), [r, orden]);
  const medios = Object.entries(r.porMedio).map(([m, v]) => ({ name: medioLabel(m), value: Math.round(v) }));
  const gastosCat = useMemo(() => {
    const m: Record<string, number> = {};
    gastos.forEach((g) => (m[g.categoria] = (m[g.categoria] ?? 0) + Number(g.monto)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [gastos]);

  function atajo(dias: number | "mes" | "mesAnt") {
    const h = new Date();
    if (dias === "mes") {
      setDesde(isoDate(inicioMes()));
      setHasta(isoDate(h));
    } else if (dias === "mesAnt") {
      setDesde(isoDate(new Date(h.getFullYear(), h.getMonth() - 1, 1)));
      setHasta(isoDate(new Date(h.getFullYear(), h.getMonth(), 0)));
    } else {
      setDesde(isoDate(new Date(h.getFullYear(), h.getMonth(), h.getDate() - dias + 1)));
      setHasta(isoDate(h));
    }
  }

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Rentabilidad, productos, medios de pago y horarios">
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm" onClick={() => atajo(1)}>Hoy</button>
          <button className="btn-ghost btn-sm" onClick={() => atajo(7)}>7 días</button>
          <button className="btn-ghost btn-sm" onClick={() => atajo("mes")}>Este mes</button>
          <button className="btn-ghost btn-sm" onClick={() => atajo("mesAnt")}>Mes anterior</button>
        </div>
        <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FiltroFacturaSelector value={filtro} onChange={setFiltro} />
        {filtro !== "ambas" && (
          <span className="text-xs text-slate-500">
            Ventas y compras: sólo {etiquetaFiltro(filtro).toLowerCase()}. Los gastos se muestran completos.
          </span>
        )}
      </div>

      {cargando ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Ventas" value={money(r.total)} tone="blue" hint={`${r.tickets} tickets · prom. ${money(r.ticketPromedio)}`} />
            <Stat
              label="Ganancia bruta"
              value={money(r.ganancia)}
              tone="green"
              hint={`Margen ${pct(r.margen)} · Costo ${money(r.costo)}${r.comisiones ? ` · Comisiones ${money(r.comisiones)}` : ""}`}
            />
            <Stat label="Gastos" value={money(gTotal)} tone="red" hint={`${gastos.length} registros`} />
            <Stat label="Resultado neto" value={money(neto)} tone={neto >= 0 ? "green" : "red"} hint="Ganancia bruta − gastos" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Ventas con / sin factura"
              value={`${pct(pctConFactura)} / ${pct(totalTodas > 0 ? 100 - pctConFactura : 0)}`}
              hint={`Con ${money(ventasConFactura)} · sin ${money(totalTodas - ventasConFactura)}`}
            />
            <Stat label="Compras de mercadería" value={money(cTotal)} hint="Flujo de fondos (no es gasto: ya está en el costo)" />
            <Stat label="Descuentos otorgados" value={money(r.descuentos)} />
            <Stat label="Ventas anuladas" value={r.anuladas} />
          </div>

          {/* Estado de resultados */}
          <div className="card mt-6 p-4">
            <h3 className="mb-3 font-semibold">Estado de resultados</h3>
            <table className="table max-w-xl">
              <tbody>
                <tr><td>Ventas netas{r.recargos !== 0 && <span className="text-xs text-slate-500"> (incluye {money(r.recargos)} de recargos/descuentos por medio de pago)</span>}</td><td className="text-right tabular-nums">{money(r.total)}</td></tr>
                <tr><td>(−) Costo de mercadería vendida</td><td className="text-right tabular-nums text-rose-600">{money(r.costo)}</td></tr>
                {r.comisiones > 0 && (
                  <tr><td>(−) Comisiones de cobro (QR, tarjetas)</td><td className="text-right tabular-nums text-rose-600">{money(r.comisiones)}</td></tr>
                )}
                <tr className="font-semibold"><td>= Ganancia bruta</td><td className="text-right tabular-nums">{money(r.ganancia)}</td></tr>
                {gastosCat.map(([c, v]) => (
                  <tr key={c} className="text-sm text-slate-500"><td className="pl-6">(−) {c}</td><td className="text-right tabular-nums">{money(v)}</td></tr>
                ))}
                <tr className={`text-lg font-bold ${neto >= 0 ? "text-emerald-600" : "text-rose-600"}`}><td>= Resultado neto</td><td className="text-right tabular-nums">{money(neto)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-2">
              <h3 className="mb-3 font-semibold">Evolución diaria</h3>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickFormatter={tickMoney} tickLine={false} axisLine={false} width={52} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Ventas" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-4">
              <h3 className="mb-3 font-semibold">Medios de pago</h3>
              {medios.length === 0 ? (
                <Empty>—</Empty>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={medios} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {medios.map((_, i) => (
                          <Cell key={i} fill={COLORES[i % COLORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-semibold">Por día de la semana</h3>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={r.porDiaSemana.map((v, i) => ({ d: DIAS_SEMANA[i], v }))}>
                    <XAxis dataKey="d" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickFormatter={tickMoney} tickLine={false} axisLine={false} width={48} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="v" name="Ventas" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-4 lg:col-span-2">
              <h3 className="mb-3 font-semibold">Por franja horaria</h3>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={r.porHora.map((v, h) => ({ h: `${h}h`, v }))}>
                    <XAxis dataKey="h" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickFormatter={tickMoney} tickLine={false} axisLine={false} width={48} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="v" name="Ventas" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card overflow-x-auto">
              <h3 className="p-4 font-semibold">Por categoría</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="text-right">Unidades</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Ganancia</th>
                    <th className="text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCategoria.map((c) => (
                    <tr key={c.categoria}>
                      <td>{c.categoria}</td>
                      <td className="text-right">{number(c.cantidad)}</td>
                      <td className="text-right tabular-nums">{money(c.total)}</td>
                      <td className="text-right tabular-nums text-emerald-600">{money(c.ganancia)}</td>
                      <td className="text-right text-xs text-slate-500">{pct(r.total ? (c.total / r.total) * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card overflow-x-auto">
              <h3 className="p-4 font-semibold">Por vendedor</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th className="text-right">Tickets</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Ticket prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porVendedor.map((v) => (
                    <tr key={v.nombre}>
                      <td>{v.nombre}</td>
                      <td className="text-right">{v.tickets}</td>
                      <td className="text-right tabular-nums">{money(v.total)}</td>
                      <td className="text-right tabular-nums">{money(v.total / v.tickets)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-6 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-2 p-4">
              <h3 className="mr-auto font-semibold">Ranking de productos</h3>
              <select className="input w-auto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
                <option value="total">Por facturación</option>
                <option value="cantidad">Por unidades</option>
                <option value="ganancia">Por ganancia</option>
              </select>
              <button
                className="btn-ghost btn-sm"
                onClick={() =>
                  descargarCSV(
                    `ranking-${desde}_${hasta}`,
                    productos.map((p) => ({
                      producto: p.nombre,
                      categoria: p.categoria,
                      unidades: p.cantidad,
                      ventas: Math.round(p.total * 100) / 100,
                      ganancia: Math.round(p.ganancia * 100) / 100,
                    }))
                  )
                }
              >
                <Download size={14} /> CSV
              </button>
            </div>
            {productos.length === 0 ? (
              <Empty>Sin ventas en el período</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="text-right">Unidades</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Ganancia</th>
                    <th className="text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.slice(0, 50).map((p, i) => (
                    <tr key={p.nombre + i}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="font-medium">{p.nombre}</td>
                      <td className="text-slate-500">{p.categoria}</td>
                      <td className="text-right">{number(p.cantidad)}</td>
                      <td className="text-right tabular-nums">{money(p.total)}</td>
                      <td className="text-right tabular-nums text-emerald-600">{money(p.ganancia)}</td>
                      <td className="text-right text-xs text-slate-500">{pct(p.total ? (p.ganancia / p.total) * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
