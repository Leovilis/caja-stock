const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export const money = (n: number | undefined | null) => ars.format(Number(n) || 0);
export const number = (n: number | undefined | null) => num.format(Number(n) || 0);
export const pct = (n: number) => `${num.format(Math.round(n * 10) / 10)}%`;

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Redondeo comercial de precios (ej: a $10 o $50) */
export const redondearPrecio = (n: number, a: number) => (a > 0 ? Math.ceil(n / a) * a : round2(n));

type Fecha = string | Date | undefined | null;

export const toDate = (t: Fecha): Date | null => {
  if (!t) return null;
  if (t instanceof Date) return t;
  // "yyyy-mm-dd" (columna date) se interpreta en hora local, no UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return parseIsoDate(t);
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};

export const fecha = (t: Fecha) => {
  const d = toDate(t);
  return d ? d.toLocaleDateString("es-AR") : "—";
};

export const fechaHora = (t: Fecha) => {
  const d = toDate(t);
  return d ? d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";
};

export const hora = (t: Fecha) => {
  const d = toDate(t);
  return d ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—";
};

export const inicioDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
export const finDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
export const inicioMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const finMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

/** yyyy-mm-dd para inputs type=date (hora local) */
export const isoDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export function parseIsoDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const margen = (costo: number, precio: number) => (costo > 0 ? ((precio - costo) / costo) * 100 : 0);

/** Number() seguro para columnas numeric */
export const n = (v: unknown) => Number(v) || 0;
