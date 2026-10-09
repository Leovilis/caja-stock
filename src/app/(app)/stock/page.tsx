"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, PackageMinus } from "lucide-react";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { money, number, fechaHora, isoDate, parseIsoDate, finDia } from "@/lib/format";
import { descargarCSV } from "@/lib/csv";
import type { MovimientoStock, Producto, Proveedor } from "@/lib/types";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";
import { AjusteStockModal } from "@/components/AjusteStockModal";

const TIPOS: Record<string, { l: string; t: "slate" | "green" | "red" | "amber" | "blue" }> = {
  venta: { l: "Venta", t: "blue" },
  compra: { l: "Ingreso", t: "green" },
  alta: { l: "Alta", t: "green" },
  ajuste: { l: "Inventario", t: "amber" },
  merma: { l: "Rotura/pérdida", t: "red" },
  vencido: { l: "Vencido", t: "red" },
  anulacion: { l: "Anulación", t: "slate" },
};

export default function StockPage() {
  const { data: productos } = useQuery<Producto>(() => supabase.from("productos").select("*").eq("activo", true), ["productos"]);
  const { data: proveedores } = useQuery<Proveedor>(() => supabase.from("proveedores").select("*"), ["proveedores"]);
  const hoy = new Date();
  const [desde, setDesde] = useState(isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7)));
  const [hasta, setHasta] = useState(isoDate(hoy));
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");
  const [ajustando, setAjustando] = useState<Producto | null>(null);

  const { data: movs } = useQuery<MovimientoStock>(
    () =>
      supabase
        .from("movimientos_stock")
        .select("*")
        .gte("fecha", parseIsoDate(desde).toISOString())
        .lte("fecha", finDia(parseIsoDate(hasta)).toISOString())
        .order("fecha", { ascending: false }),
    ["movimientos_stock"],
    `${desde}-${hasta}`
  );

  const provNombre = useMemo(() => new Map(proveedores.map((p) => [p.id, p.nombre])), [proveedores]);
  const reponer = useMemo(
    () =>
      productos
        .filter((p) => p.stock <= p.stock_min)
        .sort((a, b) => (provNombre.get(a.proveedor_id ?? "") ?? "zz").localeCompare(provNombre.get(b.proveedor_id ?? "") ?? "zz") || a.stock - b.stock),
    [productos, provNombre]
  );
  const sinStock = productos.filter((p) => p.stock <= 0).length;
  const valor = productos.reduce((a, p) => a + Math.max(0, p.stock) * p.costo, 0);
  const valorVenta = productos.reduce((a, p) => a + Math.max(0, p.stock) * p.precio, 0);

  const movsFiltrados = movs.filter((m) => (!tipo || m.tipo === tipo) && (!q || m.nombre.toLowerCase().includes(q.toLowerCase())));
  const perdidas = movs
    .filter((m) => m.tipo === "merma" || m.tipo === "vencido")
    .reduce((a, m) => a + Math.abs(m.cantidad) * (productos.find((p) => p.id === m.producto_id)?.costo ?? 0), 0);

  return (
    <div>
      <PageHeader title="Stock" subtitle="Alertas de reposición, valorización y movimientos" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stock valorizado (costo)" value={money(valor)} />
        <Stat label="Stock a precio de venta" value={money(valorVenta)} tone="blue" />
        <Stat label="Para reponer" value={reponer.length} tone="amber" hint={`${sinStock} sin stock`} icon={<AlertTriangle size={16} />} />
        <Stat label="Pérdidas en el período" value={money(perdidas)} tone="red" hint="Roturas + vencidos al costo" />
      </div>

      <div className="card mb-6 overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-semibold">Lista de reposición</h3>
          <button
            className="btn-ghost btn-sm"
            disabled={!reponer.length}
            onClick={() =>
              descargarCSV(
                "reposicion",
                reponer.map((p) => ({
                  proveedor: provNombre.get(p.proveedor_id ?? "") ?? "",
                  codigo: p.codigo,
                  producto: p.nombre,
                  stock: p.stock,
                  minimo: p.stock_min,
                  sugerido: Math.max(p.stock_min * 2 - p.stock, 1),
                }))
              )
            }
          >
            <Download size={14} /> Exportar pedido
          </button>
        </div>
        {reponer.length === 0 ? (
          <Empty>Todo el stock está por encima del mínimo 👌</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Producto</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right">Sugerido pedir</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reponer.map((p) => (
                <tr key={p.id}>
                  <td className="text-slate-500">{provNombre.get(p.proveedor_id ?? "") ?? "—"}</td>
                  <td className="font-medium">{p.nombre}</td>
                  <td className="text-right">
                    <Badge tone={p.stock <= 0 ? "red" : "amber"}>{number(p.stock)}</Badge>
                  </td>
                  <td className="text-right">{number(p.stock_min)}</td>
                  <td className="text-right font-semibold">{number(Math.max(p.stock_min * 2 - p.stock, 1))}</td>
                  <td className="text-right">
                    <button className="p-1 text-slate-400 hover:text-brand-600" onClick={() => setAjustando(p)} title="Ajustar">
                      <PackageMinus size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <h3 className="mr-auto font-semibold">Movimientos de stock</h3>
          <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <select className="input w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.l}
              </option>
            ))}
          </select>
          <input className="input w-48" placeholder="Producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {movsFiltrados.length === 0 ? (
          <Empty>Sin movimientos en el período</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Stock</th>
                <th>Detalle</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movsFiltrados.slice(0, 500).map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs">{fechaHora(m.fecha)}</td>
                  <td>{m.nombre}</td>
                  <td>
                    <Badge tone={TIPOS[m.tipo]?.t ?? "slate"}>{TIPOS[m.tipo]?.l ?? m.tipo}</Badge>
                  </td>
                  <td className={`text-right font-medium tabular-nums ${m.cantidad >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {m.cantidad > 0 ? "+" : ""}
                    {number(m.cantidad)}
                  </td>
                  <td className="text-right text-xs text-slate-500 tabular-nums">
                    {number(m.stock_anterior)} → {number(m.stock_nuevo)}
                  </td>
                  <td className="text-xs text-slate-500">{[m.ref, m.motivo].filter(Boolean).join(" · ")}</td>
                  <td className="text-xs">{m.usuario_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AjusteStockModal producto={ajustando} onClose={() => setAjustando(null)} />
    </div>
  );
}
