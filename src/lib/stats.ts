import type { Gasto, Venta } from "./types";
import { isoDate, round2, toDate } from "./format";

export interface ProductoStat {
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
  ganancia: number;
}

export function analizarVentas(ventasTodas: Venta[]) {
  const ventas = ventasTodas.filter((v) => v.estado === "completada");
  const total = round2(ventas.reduce((a, v) => a + v.total, 0));
  const costo = round2(ventas.reduce((a, v) => a + v.costo_total, 0));
  const descuentos = round2(ventas.reduce((a, v) => a + (v.descuento || 0), 0));
  const recargos = round2(ventas.reduce((a, v) => a + Number(v.recargo || 0), 0));
  const comisiones = round2(ventas.reduce((a, v) => a + Number(v.comision || 0), 0));
  // ganancia real: lo cobrado (incluye recargos) − costo de la mercadería − comisiones de cobro
  const ganancia = round2(total - costo - comisiones);

  const porMedio: Record<string, number> = {};
  const porCategoria: Record<string, { total: number; ganancia: number; cantidad: number }> = {};
  const porProducto: Record<string, ProductoStat> = {};
  const porHora: number[] = Array(24).fill(0);
  const porDiaSemana: number[] = Array(7).fill(0);
  const porDia: Record<string, { total: number; ganancia: number; tickets: number }> = {};
  const porVendedor: Record<string, { total: number; tickets: number }> = {};

  for (const v of ventas) {
    v.pagos.forEach((p) => (porMedio[p.medio] = (porMedio[p.medio] ?? 0) + Number(p.monto)));
    const d = toDate(v.fecha)!;
    porHora[d.getHours()] += v.total;
    porDiaSemana[d.getDay()] += v.total;
    const k = isoDate(d);
    porDia[k] ??= { total: 0, ganancia: 0, tickets: 0 };
    porDia[k].total += v.total;
    porDia[k].ganancia += v.total - v.costo_total - Number(v.comision || 0);
    porDia[k].tickets += 1;
    porVendedor[v.usuario_nombre] ??= { total: 0, tickets: 0 };
    porVendedor[v.usuario_nombre].total += v.total;
    porVendedor[v.usuario_nombre].tickets += 1;

    // el descuento se prorratea entre los ítems (el recargo por medio de pago no es venta de mercadería)
    const factor = v.subtotal > 0 ? (v.total - Number(v.recargo || 0)) / v.subtotal : 1;
    for (const it of v.venta_items) {
      const neto = it.subtotal * factor;
      const gan = neto - it.costo * it.cantidad;
      const cat = it.categoria || "Varios";
      porCategoria[cat] ??= { total: 0, ganancia: 0, cantidad: 0 };
      porCategoria[cat].total += neto;
      porCategoria[cat].ganancia += gan;
      porCategoria[cat].cantidad += it.cantidad;
      const key = it.producto_id ?? `varios:${it.nombre}`;
      porProducto[key] ??= { nombre: it.nombre, categoria: cat, cantidad: 0, total: 0, ganancia: 0 };
      porProducto[key].cantidad += it.cantidad;
      porProducto[key].total += neto;
      porProducto[key].ganancia += gan;
    }
  }

  return {
    ventas,
    anuladas: ventasTodas.length - ventas.length,
    total,
    costo,
    ganancia,
    descuentos,
    recargos,
    comisiones,
    margen: total > 0 ? (ganancia / total) * 100 : 0,
    tickets: ventas.length,
    ticketPromedio: ventas.length ? total / ventas.length : 0,
    porMedio,
    porCategoria: Object.entries(porCategoria)
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.total - a.total),
    productos: Object.values(porProducto),
    porHora,
    porDiaSemana,
    porDia,
    porVendedor: Object.entries(porVendedor)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}

export const totalGastos = (g: Gasto[]) => round2(g.reduce((a, x) => a + x.monto, 0));

/** Serie diaria continua entre dos fechas (incluye días sin ventas) */
export function serieDiaria(desde: Date, hasta: Date, porDia: Record<string, { total: number; ganancia: number; tickets: number }>) {
  const out: { dia: string; label: string; total: number; ganancia: number; tickets: number }[] = [];
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  while (d <= hasta && out.length < 400) {
    const k = isoDate(d);
    const v = porDia[k] ?? { total: 0, ganancia: 0, tickets: 0 };
    out.push({ dia: k, label: `${d.getDate()}/${d.getMonth() + 1}`, total: round2(v.total), ganancia: round2(v.ganancia), tickets: v.tickets });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
