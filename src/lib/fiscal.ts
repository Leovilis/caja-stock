/**
 * Separación de operaciones con factura / sin factura, para ventas y compras.
 *  - Venta "con factura": tiene una factura electrónica (A/B/C) emitida desde el sistema.
 *  - Compra "con factura": se cargó con tipo de factura del proveedor (A/B/C).
 */
import type { Compra, Comprobante, TipoFacturaCompra, Venta } from "./types";
import { numeroCbte } from "./arca/calculo";
import { round2 } from "./format";

export type FiltroFactura = "ambas" | "con" | "sin";

export const FILTROS_FACTURA: { id: FiltroFactura; label: string }[] = [
  { id: "ambas", label: "Ambas" },
  { id: "con", label: "Con factura" },
  { id: "sin", label: "Sin factura" },
];

export const TIPOS_FACTURA_COMPRA: { id: TipoFacturaCompra; label: string }[] = [
  { id: "sin_factura", label: "Sin factura (remito / nada)" },
  { id: "A", label: "Factura A" },
  { id: "B", label: "Factura B" },
  { id: "C", label: "Factura C" },
];

export const facturaDeVenta = (v: Venta): Comprobante | undefined => v.comprobantes?.find((c) => c.clase === "factura");
export const ventaConFactura = (v: Venta) => !!facturaDeVenta(v);
export const compraConFactura = (c: Compra) => !!c.fac_tipo && c.fac_tipo !== "sin_factura";

export const pasaFiltro = (conFactura: boolean, f: FiltroFactura) => f === "ambas" || (f === "con") === conFactura;
export const filtrarVentas = (vs: Venta[], f: FiltroFactura) => (f === "ambas" ? vs : vs.filter((v) => pasaFiltro(ventaConFactura(v), f)));
export const filtrarCompras = (cs: Compra[], f: FiltroFactura) => (f === "ambas" ? cs : cs.filter((c) => pasaFiltro(compraConFactura(c), f)));

export const etiquetaFiltro = (f: FiltroFactura) => FILTROS_FACTURA.find((x) => x.id === f)?.label ?? "";

/** Una línea del libro (venta o compra) ya normalizada */
export interface Movimiento {
  id: string;
  fecha: string;
  clase: "venta" | "compra";
  conFactura: boolean;
  comprobante: string; // "FB 00001-00000012" | "Ticket #123" | "FA 0003-000123" | "Sin factura"
  contraparte: string;
  neto: number;
  iva: number;
  total: number;
}

export function movimientoVenta(v: Venta): Movimiento {
  const f = facturaDeVenta(v);
  return {
    id: v.id,
    fecha: v.fecha,
    clase: "venta",
    conFactura: !!f,
    comprobante: f ? `F${f.letra} ${numeroCbte(f.punto_venta, f.numero)}` : `Ticket #${v.numero}`,
    contraparte: f ? f.receptor_nombre || "Consumidor final" : "Consumidor final",
    // la factura C (monotributo) no discrimina IVA: imp_iva = 0
    neto: f ? Number(f.imp_neto) : Number(v.total),
    iva: f ? Number(f.imp_iva) : 0,
    total: Number(v.total),
  };
}

export function movimientoCompra(c: Compra): Movimiento {
  const con = compraConFactura(c);
  const iva = con ? Number(c.fac_iva) || 0 : 0;
  return {
    id: c.id,
    fecha: c.fecha,
    clase: "compra",
    conFactura: con,
    comprobante: con ? `F${c.fac_tipo}${c.comprobante ? " " + c.comprobante : ""}` : c.comprobante ? `Sin factura (${c.comprobante})` : "Sin factura",
    contraparte: c.proveedor_nombre,
    neto: round2(Number(c.total) - iva),
    iva,
    total: Number(c.total),
  };
}

/** Sugerencia de IVA contenido en un total (factura A al 21%) */
export const ivaContenido = (total: number, alicuota = 21) => round2(total - total / (1 + alicuota / 100));
