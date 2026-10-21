"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { money, fecha, isoDate, parseIsoDate, finDia, inicioMes, toDate, round2 } from "@/lib/format";
import { descargarCSV } from "@/lib/csv";
import { etiquetaFiltro, movimientoCompra, movimientoVenta, pasaFiltro, type Movimiento } from "@/lib/fiscal";
import { FiltroFacturaSelector, useFiltroFactura } from "@/components/FiltroFactura";
import type { Compra, Venta } from "@/lib/types";
import { Badge, Empty, Loading, PageHeader, Stat } from "@/components/ui";

type Vista = "todo" | "venta" | "compra";
const POR_PAGINA = 300;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const csvNum = (n: number) => String(round2(n)).replace(".", ",");

interface Totales {
  ventas: number;
  ventasN: number;
  compras: number;
  comprasN: number;
  ivaDebito: number;
  ivaCredito: number;
}
const vacio = (): Totales => ({ ventas: 0, ventasN: 0, compras: 0, comprasN: 0, ivaDebito: 0, ivaCredito: 0 });
function sumar(t: Totales, m: Movimiento) {
  if (m.clase === "venta") {
    t.ventas += m.total;
    t.ventasN += 1;
    t.ivaDebito += m.iva;
  } else {
    t.compras += m.total;
    t.comprasN += 1;
    t.ivaCredito += m.iva;
  }
}

export default function LibroPage() {
  const { config } = useApp();
  const esRI = config.fiscal_condicion === "responsable_inscripto";
  const [desde, setDesde] = useState(isoDate(inicioMes()));
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [filtro, setFiltro] = useFiltroFactura();
  const [vista, setVista] = useState<Vista>("todo");
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const ini = parseIsoDate(desde).toISOString();
  const fin = finDia(parseIsoDate(hasta)).toISOString();
  const key = `${desde}-${hasta}`;

  const { data: ventas, cargando } = useQuery<Venta>(
    () =>
      supabase
        .from("ventas")
        .select("id, numero, fecha, total, estado, comprobantes(clase, letra, punto_venta, numero, receptor_nombre, imp_neto, imp_iva)")
        .eq("estado", "completada")
        .gte("fecha", ini)
        .lte("fecha", fin),
    ["ventas", "comprobantes"],
    key
  );
  const { data: compras } = useQuery<Compra>(() => supabase.from("compras").select("*").gte("fecha", ini).lte("fecha", fin), ["compras"], key);

  // Todas las operaciones normalizadas, de la más nueva a la más vieja
  const todos = useMemo(
    () => [...ventas.map(movimientoVenta), ...compras.map(movimientoCompra)].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [ventas, compras]
  );
  const filtrados = useMemo(() => todos.filter((m) => pasaFiltro(m.conFactura, filtro)), [todos, filtro]);

  const { tot, con, sin, meses } = useMemo(() => {
    const tot = vacio(), con = vacio(), sin = vacio();
    const meses: Record<string, Totales> = {};
    for (const m of todos) {
      sumar(m.conFactura ? con : sin, m);
      if (!pasaFiltro(m.conFactura, filtro)) continue;
      sumar(tot, m);
      const d = toDate(m.fecha)!;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      sumar((meses[k] ??= vacio()), m);
    }
    return { tot, con, sin, meses: Object.entries(meses).sort((a, b) => b[0].localeCompare(a[0])) };
  }, [todos, filtro]);

  const lista = vista === "todo" ? filtrados : filtrados.filter((m) => m.clase === vista);
  const diferencia = tot.ventas - tot.compras;
  const mostrarIva = esRI && filtro !== "sin";

  function atajo(t: "mes" | "mesAnt" | "anio") {
    const h = new Date();
    if (t === "mes") {
      setDesde(isoDate(inicioMes()));
      setHasta(isoDate(h));
    } else if (t === "mesAnt") {
      setDesde(isoDate(new Date(h.getFullYear(), h.getMonth() - 1, 1)));
      setHasta(isoDate(new Date(h.getFullYear(), h.getMonth(), 0)));
    } else {
      setDesde(isoDate(new Date(h.getFullYear(), 0, 1)));
      setHasta(isoDate(h));
    }
    setMostrar(POR_PAGINA);
  }

  function exportar() {
    descargarCSV(
      `libro-${filtro}-${desde}_${hasta}`,
      [...filtrados].reverse().map((m) => ({
        fecha: fecha(m.fecha),
        operacion: m.clase === "venta" ? "Venta" : "Compra",
        factura: m.conFactura ? "Con factura" : "Sin factura",
        comprobante: m.comprobante,
        contraparte: m.contraparte,
        neto: csvNum(m.neto),
        iva: csvNum(m.iva),
        total: csvNum(m.total),
      }))
    );
  }

  return (
    <div>
      <PageHeader title="Libro de compras y ventas" subtitle="Todo lo que entró y salió en un solo lugar, con o sin factura">
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm" onClick={() => atajo("mes")}>Este mes</button>
          <button className="btn-ghost btn-sm" onClick={() => atajo("mesAnt")}>Mes anterior</button>
          <button className="btn-ghost btn-sm" onClick={() => atajo("anio")}>Este año</button>
        </div>
        <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button className="btn-ghost" onClick={exportar} disabled={!filtrados.length}>
          <Download size={16} /> CSV
        </button>
      </PageHeader>

      <div className="mb-4">
        <FiltroFacturaSelector
          value={filtro}
          onChange={(f) => {
            setFiltro(f);
            setMostrar(POR_PAGINA);
          }}
        />
      </div>

      {cargando ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Ventas" value={money(tot.ventas)} tone="blue" hint={`${tot.ventasN} operaciones`} />
            <Stat label="Compras" value={money(tot.compras)} tone="amber" hint={`${tot.comprasN} operaciones`} />
            <Stat label="Ventas − compras" value={money(diferencia)} tone={diferencia >= 0 ? "green" : "red"} hint="Diferencia del período (no incluye gastos)" />
          </div>

          {mostrarIva && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="IVA débito fiscal" value={money(tot.ivaDebito)} hint="IVA de tus facturas A y B emitidas" />
              <Stat label="IVA crédito fiscal" value={money(tot.ivaCredito)} hint="IVA de las facturas A de proveedores" />
              <Stat
                label={tot.ivaDebito - tot.ivaCredito >= 0 ? "Saldo IVA a pagar (estimado)" : "Saldo IVA a favor (estimado)"}
                value={money(Math.abs(tot.ivaDebito - tot.ivaCredito))}
                tone={tot.ivaDebito - tot.ivaCredito >= 0 ? "red" : "green"}
                hint="Orientativo: no incluye percepciones ni retenciones"
              />
            </div>
          )}

          {filtro === "ambas" && (
            <div className="card mt-6 overflow-x-auto p-4">
              <h3 className="mb-3 font-semibold">Con factura vs. sin factura</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th className="text-right">Con factura</th>
                    <th className="text-right">Sin factura</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">% con factura</th>
                  </tr>
                </thead>
                <tbody>
                  <FilaComparacion label="Ventas" con={con.ventas} sin={sin.ventas} />
                  <FilaComparacion label="Compras" con={con.compras} sin={sin.compras} />
                  <FilaComparacion label="Ventas − compras" con={con.ventas - con.compras} sin={sin.ventas - sin.compras} sinPct />
                </tbody>
              </table>
            </div>
          )}

          {meses.length > 1 && (
            <div className="card mt-6 overflow-x-auto p-4">
              <h3 className="mb-3 font-semibold">Por mes {filtro !== "ambas" && <span className="text-sm font-normal text-slate-500">· {etiquetaFiltro(filtro).toLowerCase()}</span>}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Compras</th>
                    <th className="text-right">Diferencia</th>
                    {mostrarIva && <th className="text-right">IVA débito</th>}
                    {mostrarIva && <th className="text-right">IVA crédito</th>}
                  </tr>
                </thead>
                <tbody>
                  {meses.map(([k, t]) => (
                    <tr key={k}>
                      <td className="font-medium">{MESES[Number(k.slice(5)) - 1]} {k.slice(0, 4)}</td>
                      <td className="text-right tabular-nums">{money(t.ventas)}</td>
                      <td className="text-right tabular-nums">{money(t.compras)}</td>
                      <td className={`text-right font-semibold tabular-nums ${t.ventas - t.compras >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(t.ventas - t.compras)}</td>
                      {mostrarIva && <td className="text-right tabular-nums">{money(t.ivaDebito)}</td>}
                      {mostrarIva && <td className="text-right tabular-nums">{money(t.ivaCredito)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card mt-6 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <h3 className="font-semibold">Detalle</h3>
              <div className="flex gap-1">
                {(["todo", "venta", "compra"] as Vista[]).map((v) => (
                  <button key={v} className={`btn-sm ${vista === v ? "btn-primary" : "btn-ghost"}`} onClick={() => setVista(v)}>
                    {v === "todo" ? "Todo" : v === "venta" ? "Ventas" : "Compras"}
                  </button>
                ))}
              </div>
            </div>
            {lista.length === 0 ? (
              <Empty>Sin operaciones en el período</Empty>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Operación</th>
                      <th>Comprobante</th>
                      <th>Cliente / proveedor</th>
                      <th className="text-right">Neto</th>
                      <th className="text-right">IVA</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.slice(0, mostrar).map((m) => (
                      <tr key={m.clase + m.id}>
                        <td className="text-xs">{fecha(m.fecha)}</td>
                        <td>
                          <Badge tone={m.clase === "venta" ? "blue" : "amber"}>{m.clase === "venta" ? "Venta" : "Compra"}</Badge>
                        </td>
                        <td>
                          {m.conFactura ? <span className="font-medium text-emerald-700">{m.comprobante}</span> : <span className="text-slate-500">{m.comprobante}</span>}
                        </td>
                        <td>{m.contraparte}</td>
                        <td className="text-right tabular-nums">{money(m.neto)}</td>
                        <td className="text-right tabular-nums">{m.iva ? money(m.iva) : "—"}</td>
                        <td className={`text-right font-semibold tabular-nums ${m.clase === "compra" ? "text-amber-700" : ""}`}>
                          {m.clase === "compra" ? "−" : ""}
                          {money(m.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lista.length > mostrar && (
                  <div className="p-3 text-center">
                    <button className="btn-ghost btn-sm" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
                      Mostrar más ({lista.length - mostrar} restantes)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilaComparacion({ label, con, sin, sinPct }: { label: string; con: number; sin: number; sinPct?: boolean }) {
  const total = con + sin;
  return (
    <tr>
      <td className="font-medium">{label}</td>
      <td className="text-right tabular-nums text-emerald-700">{money(con)}</td>
      <td className="text-right tabular-nums">{money(sin)}</td>
      <td className="text-right font-semibold tabular-nums">{money(total)}</td>
      <td className="text-right tabular-nums text-slate-500">{sinPct || total <= 0 ? "—" : `${Math.round((con / total) * 100)}%`}</td>
    </tr>
  );
}
