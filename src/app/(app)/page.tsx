"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { money, number, inicioDia, inicioMes, pct, isoDate } from "@/lib/format";
import { analizarVentas, serieDiaria, totalGastos } from "@/lib/stats";
import type { Gasto, Producto, Venta } from "@/lib/types";
import { medioLabel } from "@/lib/types";
import { PageHeader, Stat, Empty } from "@/components/ui";

const tickMoney = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`);

export default function Dashboard() {
  const { caja, perfil } = useApp();
  const hoy = inicioDia();
  const hace14 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 13);
  const mes = inicioMes();
  const desde = hace14 < mes ? hace14 : mes;

  const { data: ventas } = useQuery<Venta>(
    () => supabase.from("ventas").select("*, venta_items(*)").gte("fecha", desde.toISOString()),
    ["ventas"],
    desde.toISOString()
  );
  const { data: gastos } = useQuery<Gasto>(() => supabase.from("gastos").select("*").gte("fecha", isoDate(mes)), ["gastos"], isoDate(mes));
  const { data: productos } = useQuery<Producto>(() => supabase.from("productos").select("*").eq("activo", true), ["productos"]);

  const r = useMemo(() => {
    const ayer = new Date(hoy.getTime() - 86400000);
    const vHoy = ventas.filter((v) => new Date(v.fecha) >= hoy);
    const vAyer = ventas.filter((v) => new Date(v.fecha) >= ayer && new Date(v.fecha) < hoy);
    const vMes = ventas.filter((v) => new Date(v.fecha) >= mes);
    const ult14 = analizarVentas(ventas.filter((v) => new Date(v.fecha) >= hace14));
    return {
      hoy: analizarVentas(vHoy),
      ayer: analizarVentas(vAyer),
      mes: analizarVentas(vMes),
      serie: serieDiaria(hace14, new Date(), ult14.porDia),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas]);

  const gastosMes = totalGastos(gastos);
  const resultadoMes = r.mes.ganancia - gastosMes;
  const bajos = productos.filter((p) => p.stock <= p.stock_min);
  const variacion = r.ayer.total > 0 ? ((r.hoy.total - r.ayer.total) / r.ayer.total) * 100 : null;
  const top = [...r.hoy.productos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
  const horas = r.hoy.porHora.map((v, h) => ({ h: `${h}h`, v })).filter((_, h) => h >= 7);

  return (
    <div>
      <PageHeader title={`Hola, ${perfil?.nombre?.split(" ")[0] ?? ""}`} subtitle={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}>
        <Link href="/pos" className="btn-success">
          <ShoppingCart size={16} /> Ir a vender
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Ventas de hoy"
          value={money(r.hoy.total)}
          tone="blue"
          hint={variacion === null ? `${r.hoy.tickets} tickets` : `${r.hoy.tickets} tickets · ${variacion >= 0 ? "▲" : "▼"} ${pct(Math.abs(variacion))} vs ayer`}
          icon={<TrendingUp size={16} />}
        />
        <Stat label="Ganancia bruta hoy" value={money(r.hoy.ganancia)} tone="green" hint={`Margen ${pct(r.hoy.margen)} · Ticket prom. ${money(r.hoy.ticketPromedio)}`} />
        <Stat
          label="Resultado del mes"
          value={money(resultadoMes)}
          tone={resultadoMes >= 0 ? "green" : "red"}
          hint={`Ventas ${money(r.mes.total)} · Gastos ${money(gastosMes)}`}
        />
        <Stat
          label="Caja"
          value={caja ? "Abierta" : "Cerrada"}
          tone={caja ? "green" : "red"}
          hint={caja ? `desde ${new Date(caja.apertura).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · ${caja.abierta_por_nombre}` : <Link href="/caja" className="text-brand-600">Abrir caja</Link>}
          icon={<Wallet size={16} />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 font-semibold">Ventas últimos 14 días</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={r.serie}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickFormatter={tickMoney} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="total" name="Ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ganancia" name="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Hoy por medio de pago</h3>
          {Object.keys(r.hoy.porMedio).length === 0 ? (
            <Empty>Sin ventas hoy</Empty>
          ) : (
            Object.entries(r.hoy.porMedio)
              .sort((a, b) => b[1] - a[1])
              .map(([m, v]) => (
                <div key={m} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span>{medioLabel(m)}</span>
                    <span className="font-medium tabular-nums">{money(v)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-brand-500" style={{ width: `${(v / r.hoy.total) * 100}%` }} />
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 font-semibold">Ventas por hora (hoy)</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={horas}>
                <XAxis dataKey="h" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickFormatter={tickMoney} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="v" name="Ventas" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Más vendidos hoy</h3>
          {top.length === 0 ? (
            <Empty>—</Empty>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {top.map((p, i) => (
                <li key={p.nombre} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="mr-1 text-slate-400">{i + 1}.</span>
                    {p.nombre}
                  </span>
                  <span className="whitespace-nowrap font-medium">{number(p.cantidad)} u.</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {bajos.length > 0 && (
        <div className="card mt-6 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle size={18} /> {bajos.length} productos con stock bajo o agotado
            </h3>
            <Link href="/stock" className="text-sm text-amber-800 underline">
              Ver lista de reposición
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {bajos.slice(0, 15).map((p) => (
              <span key={p.id} className={`badge ${p.stock <= 0 ? "bg-rose-100 text-rose-700" : "bg-white text-amber-800"}`}>
                {p.nombre} ({number(p.stock)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
