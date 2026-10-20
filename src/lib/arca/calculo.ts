// Lógica pura de facturación (se usa en el servidor y en la pantalla). Sin dependencias de red.

export type CondicionFiscal = "monotributo" | "responsable_inscripto";
export type Letra = "A" | "B" | "C";

/** Condición frente al IVA del receptor (RG 5616 · CondicionIVAReceptorId) */
export const CONDICIONES_RECEPTOR: { id: number; label: string }[] = [
  { id: 5, label: "Consumidor Final" },
  { id: 1, label: "IVA Responsable Inscripto" },
  { id: 6, label: "Responsable Monotributo" },
  { id: 4, label: "IVA Sujeto Exento" },
  { id: 13, label: "Monotributista Social" },
  { id: 16, label: "Monotributo Trabajador Independiente Promovido" },
  { id: 7, label: "Sujeto No Categorizado" },
  { id: 15, label: "IVA No Alcanzado" },
];
export const condicionLabel = (id: number) => CONDICIONES_RECEPTOR.find((c) => c.id === id)?.label ?? String(id);

export const TIPOS_DOC: { id: number; label: string }[] = [
  { id: 99, label: "Sin identificar (consumidor final)" },
  { id: 96, label: "DNI" },
  { id: 80, label: "CUIT" },
  { id: 86, label: "CUIL" },
];

/** Códigos de comprobante ARCA */
export const TIPO_CBTE = {
  factura: { A: 1, B: 6, C: 11 },
  nota_credito: { A: 3, B: 8, C: 13 },
} as const;

export const nombreCbte = (clase: "factura" | "nota_credito", letra: Letra) =>
  `${clase === "factura" ? "FACTURA" : "NOTA DE CRÉDITO"} ${letra}`;

/** Ids de alícuota de IVA de ARCA */
export const ID_ALICUOTA: Record<string, number> = { "0": 3, "2.5": 9, "5": 8, "10.5": 4, "21": 5, "27": 6 };
export const ALICUOTAS = [21, 10.5, 27, 5, 2.5, 0];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Letra que corresponde según emisor y receptor */
export function letraPara(emisor: CondicionFiscal, condReceptor: number): Letra {
  if (emisor === "monotributo") return "C";
  return condReceptor === 1 ? "A" : "B";
}

export interface ItemFiscal {
  subtotal: number; // precio final (IVA incluido) × cantidad
  alicuota_iva: number;
}

export interface Importes {
  imp_total: number;
  imp_neto: number;
  imp_iva: number;
  iva: { alicuota: number; id: number; base: number; importe: number }[];
}

/**
 * Calcula importes del comprobante a partir del total cobrado (precios finales con IVA).
 * El descuento de la venta se prorratea entre los ítems.
 * - C (monotributo): neto = total, sin IVA discriminado.
 * - A/B (RI): se separa el IVA por alícuota. ImpTotal = ImpNeto + ImpIVA exacto al centavo.
 */
export function calcularImportes(letra: Letra, items: ItemFiscal[], total: number): Importes {
  total = r2(total);
  if (letra === "C") return { imp_total: total, imp_neto: total, imp_iva: 0, iva: [] };

  const subtotal = items.reduce((a, i) => a + Number(i.subtotal), 0);
  const factor = subtotal > 0 ? total / subtotal : 0;
  // total final por alícuota (después del descuento)
  const porAlic = new Map<number, number>();
  for (const it of items) {
    const a = Number(it.alicuota_iva);
    porAlic.set(a, (porAlic.get(a) ?? 0) + Number(it.subtotal) * factor);
  }
  // redondeo por alícuota y ajuste del centavo para que sume exacto el total
  const entradas = [...porAlic.entries()].map(([a, t]) => ({ a, t: r2(t) }));
  const dif = r2(total - entradas.reduce((x, e) => x + e.t, 0));
  if (entradas.length && dif !== 0) entradas.sort((x, y) => y.t - x.t)[0].t = r2(entradas[0].t + dif);

  const iva = entradas
    .filter((e) => e.t !== 0)
    .map(({ a, t }) => {
      const base = r2(t / (1 + a / 100));
      return { alicuota: a, id: ID_ALICUOTA[String(a)] ?? 5, base, importe: r2(t - base) };
    })
    .sort((x, y) => y.alicuota - x.alicuota);
  const imp_neto = r2(iva.reduce((x, e) => x + e.base, 0));
  const imp_iva = r2(iva.reduce((x, e) => x + e.importe, 0));
  return { imp_total: r2(imp_neto + imp_iva), imp_neto, imp_iva, iva };
}

/** Validaciones previas antes de pedir el CAE */
export function validarReceptor(letra: Letra, docTipo: number, docNro: number, condReceptor: number): string | null {
  if (letra === "A") {
    if (docTipo !== 80) return "La factura A requiere CUIT del receptor";
    if (condReceptor !== 1) return "La factura A es para receptores Responsables Inscriptos";
  }
  if (docTipo === 99 && docNro !== 0) return "Sin identificar: el número de documento debe quedar vacío";
  if (docTipo !== 99 && !docNro) return "Ingresá el número de documento";
  if ((docTipo === 80 || docTipo === 86) && !cuitValido(String(docNro))) return "El CUIT/CUIL no es válido";
  if (docTipo === 99 && condReceptor !== 5) return "Un receptor sin identificar sólo puede ser Consumidor Final";
  return null;
}

/** Dígito verificador de CUIT/CUIL */
export function cuitValido(cuit: string): boolean {
  const c = cuit.replace(/\D/g, "");
  if (c.length !== 11) return false;
  const m = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = m.reduce((a, f, i) => a + f * Number(c[i]), 0);
  let dv = 11 - (s % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(c[10]);
}

/** URL del QR obligatorio (RG 4892) */
export function urlQR(d: {
  fecha: string; // yyyy-mm-dd
  cuit: string;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  cae: string;
}) {
  const json = {
    ver: 1,
    fecha: d.fecha,
    cuit: Number(d.cuit.replace(/\D/g, "")),
    ptoVta: d.ptoVta,
    tipoCmp: d.tipoCmp,
    nroCmp: d.nroCmp,
    importe: r2(d.importe),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: d.tipoDocRec,
    nroDocRec: d.nroDocRec,
    tipoCodAut: "E",
    codAut: Number(d.cae),
  };
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(JSON.stringify(json)).toString("base64")
      : btoa(unescape(encodeURIComponent(JSON.stringify(json))));
  return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
}

export const numeroCbte = (ptoVta: number, nro: number) => `${String(ptoVta).padStart(5, "0")}-${String(nro).padStart(8, "0")}`;
