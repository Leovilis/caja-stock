// Tipos que reflejan las tablas de supabase/schema.sql (snake_case igual que la base)

export type Rol = "admin" | "vendedor";

export interface Perfil {
  id: string;
  comercio_id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string;
  marca: string;
  costo: number;
  precio: number;
  stock: number;
  stock_min: number;
  proveedor_id: string | null;
  activo: boolean;
  favorito: boolean;
  alicuota_iva: number;
  creado?: string;
  actualizado?: string;
  precio_desde?: string; // desde cuándo rige el precio (cenefas)
}

/** Medios básicos (también los que usa el negocio para pagar gastos y compras) */
export type MedioPago = "efectivo" | "debito" | "credito" | "transferencia" | "qr";

export const MEDIOS_PAGO: { id: MedioPago; label: string }[] = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "transferencia", label: "Transferencia" },
  { id: "qr", label: "QR / Mercado Pago" },
];

// Nombres de los medios configurados por el comercio (los registra AppContext al cargar la configuración)
let nombresMedios: Record<string, string> = {};
export function registrarMedios(lista: { id: string; nombre: string }[]) {
  nombresMedios = Object.fromEntries(lista.map((m) => [m.id, m.nombre]));
}

export const medioLabel = (m: string) =>
  m === "cuenta_corriente" ? "Cuenta corriente" : (nombresMedios[m] ?? MEDIOS_PAGO.find((x) => x.id === m)?.label ?? m);

export interface VentaItem {
  id?: number;
  producto_id: string | null; // null = ítem "varios"
  nombre: string;
  codigo: string;
  categoria: string;
  cantidad: number;
  precio: number;
  costo: number;
  subtotal: number;
  alicuota_iva?: number;
}

export interface Pago {
  medio: string; // id del medio configurado (ej: "efectivo", "qr_mp_credito")
  monto: number; // lo cobrado con ese medio (incluye su recargo)
  recargo?: number;
  nombre?: string; // nombre del medio al momento de la venta
  mp_order?: string; // orden de Mercado Pago (cobro con QR automático, ya aprobado)
  sin_recargo?: boolean;
}

/** Medio de cobro configurado por el comercio */
export interface MedioConfig {
  id: string;
  nombre: string;
  grupo?: string; // procesador (ej: "QR Mercado Pago"): en la caja se muestran juntos
  activo: boolean;
  recargo: number; // % que se le suma al cliente (negativo = descuento)
  comision: number; // % sin IVA que retiene el procesador
}

const BASICOS: MedioConfig[] = MEDIOS_PAGO.map((m) => ({ id: m.id, nombre: m.label, activo: true, recargo: 0, comision: 0 }));

/**
 * Medios del comercio. Sin configuración: los 5 básicos.
 * Efectivo siempre existe y va primero (la caja cuenta el efectivo por ese id).
 */
export function mediosDe(cfg: { medios_pago?: Partial<MedioConfig>[] }): MedioConfig[] {
  const guardados = (cfg.medios_pago ?? []).filter((m) => m.id);
  const base = guardados.length ? guardados : BASICOS;
  const lista = base.map((c) => {
    const def = MEDIOS_PAGO.find((x) => x.id === c.id);
    return {
      id: String(c.id),
      nombre: (c.nombre || def?.label || String(c.id)).trim(),
      grupo: c.grupo || undefined,
      activo: c.activo ?? true,
      recargo: Number(c.recargo ?? 0),
      comision: Number(c.comision ?? 0),
    };
  });
  const efectivo = lista.find((m) => m.id === "efectivo") ?? BASICOS[0];
  return [efectivo, ...lista.filter((m) => m.id !== "efectivo")];
}

/** "QR Mercado Pago · Crédito" con grupo "QR Mercado Pago" → "Crédito" */
export const nombreCorto = (m: MedioConfig) =>
  m.grupo && m.nombre.startsWith(m.grupo) ? m.nombre.slice(m.grupo.length).replace(/^\s*[·\-–:]\s*/, "") || m.nombre : m.nombre;

/** Plantillas de procesadores (valores de referencia: verificá los de tu cuenta) */
export const PLANTILLAS_MEDIOS: { grupo: string; medios: { id: string; tipo: string; comision: number }[] }[] = [
  {
    grupo: "QR Naranja X",
    medios: [
      { id: "qr_naranja_cuenta", tipo: "Dinero en cuenta", comision: 0.8 },
      { id: "qr_naranja_debito", tipo: "Débito", comision: 1.2 },
      { id: "qr_naranja_credito", tipo: "Crédito", comision: 4.5 },
    ],
  },
  {
    grupo: "QR Mercado Pago",
    medios: [
      { id: "qr_mp_cuenta", tipo: "Dinero en cuenta", comision: 0.8 },
      { id: "qr_mp_debito", tipo: "Débito", comision: 1.35 },
      { id: "qr_mp_credito", tipo: "Crédito", comision: 5.99 },
    ],
  },
  {
    grupo: "Point Mercado Pago",
    medios: [
      { id: "point_mp_debito", tipo: "Débito", comision: 2.99 },
      { id: "point_mp_credito", tipo: "Crédito", comision: 5.99 },
    ],
  },
];

/** Lo que se le cobra al cliente por pagar `base` con ese medio */
export const conRecargo = (base: number, m?: Pick<MedioConfig, "recargo">) => Math.round(base * (1 + (m?.recargo ?? 0) / 100) * 100) / 100;
/** Comisión estimada (con IVA 21 %) sobre lo cobrado */
export const comisionDe = (cobrado: number, m?: Pick<MedioConfig, "comision">) => Math.round(((cobrado * (m?.comision ?? 0) * 1.21) / 100) * 100) / 100;

export interface Venta {
  id: string;
  numero: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  recargo?: number; // recargo/descuento por medio de pago (incluido en total)
  total: number;
  costo_total: number;
  comision?: number; // comisión estimada de los procesadores
  pagos: Pago[];
  recibido: number;
  vuelto: number;
  caja_id: string;
  usuario_id: string;
  usuario_nombre: string;
  estado: "completada" | "anulada";
  motivo_anulacion?: string | null;
  anulada_por?: string | null;
  venta_items: VentaItem[];
  comprobantes?: Comprobante[];
}

export interface Comprobante {
  id: string;
  venta_id: string;
  clase: "factura" | "nota_credito";
  letra: "A" | "B" | "C";
  tipo: number;
  punto_venta: number;
  numero: number;
  fecha: string;
  cae: string;
  cae_vto: string;
  doc_tipo: number;
  doc_nro: number;
  receptor_nombre: string;
  receptor_domicilio: string;
  receptor_condicion: number;
  imp_total: number;
  imp_neto: number;
  imp_iva: number;
  iva: { alicuota: number; id: number; base: number; importe: number }[];
  asociado_id: string | null;
  ambiente: "homologacion" | "produccion";
  emisor_cuit: string;
  emitido_por: string;
}

export interface Caja {
  id: string;
  estado: "abierta" | "cerrada";
  apertura: string;
  abierta_por: string;
  abierta_por_nombre: string;
  monto_inicial: number;
  cierre?: string | null;
  cerrada_por_nombre?: string | null;
  total_ventas?: number | null;
  cant_ventas?: number | null;
  por_medio?: Record<string, number> | null;
  ingresos?: number | null;
  egresos?: number | null;
  efectivo_esperado?: number | null;
  efectivo_contado?: number | null;
  diferencia?: number | null;
  observaciones?: string | null;
}

export interface MovimientoCaja {
  id: string;
  caja_id: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  concepto: string;
  fecha: string;
  usuario_nombre: string;
}

export interface Gasto {
  id: string;
  fecha: string; // yyyy-mm-dd
  categoria: string;
  descripcion: string;
  monto: number;
  medio: MedioPago;
  caja_id: string | null;
  usuario_nombre: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  cuit: string;
  dias_visita: string;
  notas: string;
}

export interface ItemCompra {
  producto_id: string;
  nombre: string;
  cantidad: number;
  costo: number;
  subtotal: number;
  vence?: string; // YYYY-MM-DD (opcional): crea un vencimiento
}

export interface Compra {
  id: string;
  fecha: string;
  proveedor_id: string | null;
  proveedor_nombre: string;
  comprobante: string;
  items: ItemCompra[];
  total: number;
  medio: string;
  pagado_desde_caja: boolean;
  usuario_nombre: string;
  fac_tipo: TipoFacturaCompra;
  fac_iva: number;
}

export type TipoFacturaCompra = "sin_factura" | "A" | "B" | "C";

export type TipoMovStock = "venta" | "compra" | "ajuste" | "merma" | "vencido" | "anulacion" | "alta";

export interface MovimientoStock {
  id: number;
  producto_id: string;
  nombre: string;
  tipo: TipoMovStock;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string | null;
  ref: string | null;
  fecha: string;
  usuario_nombre: string;
}

export interface Config {
  nombre: string;
  direccion: string;
  telefono: string;
  cuit: string;
  pie_ticket: string;
  ancho_ticket: 58 | 80;
  permitir_stock_negativo: boolean;
  imprimir_automatico: boolean;
  categorias_producto: string[];
  categorias_gasto: string[];
  fiscal_condicion: "monotributo" | "responsable_inscripto";
  fiscal_cuit: string;
  fiscal_razon_social: string;
  fiscal_domicilio: string;
  fiscal_iibb: string;
  fiscal_inicio_actividades: string | null;
  fiscal_punto_venta: number;
  fiscal_ambiente: "homologacion" | "produccion";
  alicuota_varios: number;
  dias_aviso_vencimiento: number;
  medios_pago: MedioConfig[];
  alias_transferencia: string;
}

export const CONFIG_DEFAULT: Config = {
  nombre: "Mi Drugstore",
  direccion: "",
  telefono: "",
  cuit: "",
  pie_ticket: "¡Gracias por su compra!",
  ancho_ticket: 80,
  permitir_stock_negativo: false,
  imprimir_automatico: false,
  categorias_producto: ["Varios"],
  categorias_gasto: ["Otros"],
  fiscal_condicion: "monotributo",
  fiscal_cuit: "",
  fiscal_razon_social: "",
  fiscal_domicilio: "",
  fiscal_iibb: "",
  fiscal_inicio_actividades: null,
  fiscal_punto_venta: 1,
  fiscal_ambiente: "homologacion",
  alicuota_varios: 21,
  dias_aviso_vencimiento: 7,
  medios_pago: [],
  alias_transferencia: "",
};

/** ¿Están cargados los datos mínimos para facturar? */
export const facturacionConfigurada = (c: Config) => !!(c.fiscal_cuit && c.fiscal_razon_social && c.fiscal_punto_venta > 0);

// ---------------------------------------------------------------------
// Plan y vencimiento del comercio (tabla `comercios`; sólo lo cambia el administrador general)
// ---------------------------------------------------------------------
export type Plan = "basico" | "completo";

export type Modulo =
  | "inicio"
  | "pos"
  | "caja"
  | "ventas"
  | "productos"
  | "stock"
  | "compras"
  | "proveedores"
  | "gastos"
  | "reportes"
  | "libro"
  | "facturacion"
  | "usuarios"
  | "configuracion";

/** Módulos incluidos en el plan básico (debe coincidir con modulo_habilitado() en schema.sql) */
export const MODULOS_BASICO: Modulo[] = ["pos", "caja", "ventas", "productos", "stock", "usuarios", "configuracion"];

export interface Licencia {
  id: string;
  nombre: string;
  plan: Plan;
  vence: string | null; // YYYY-MM-DD, último día de uso
  activo: boolean; // false = suspendido
  contacto: string;
}

/** Mientras carga: plan básico sin vencimiento (no muestra de más) */
export const LICENCIA_DEFAULT: Licencia = { id: "", nombre: "", plan: "basico", vence: null, activo: true, contacto: "" };

/** Fila del panel de clientes (función admin_comercios) */
export interface ComercioAdmin {
  id: string;
  nombre: string;
  plan: Plan;
  vence: string | null;
  activo: boolean;
  contacto: string;
  notas: string;
  creado: string;
  usuarios: number;
  dueno: string | null;
  ventas_30d: number;
  total_30d: number;
  ultima_venta: string | null;
  productos: number;
}

export const moduloHabilitado = (l: Licencia, m: Modulo) => l.plan === "completo" || MODULOS_BASICO.includes(m);

/** Días que faltan hasta el vencimiento (0 = vence hoy, negativo = vencida, null = sin vencimiento), en hora Argentina */
export function diasLicencia(l: Licencia): number | null {
  if (!l.vence) return null;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return Math.round((Date.parse(l.vence) - Date.parse(hoy)) / 86_400_000);
}

// ---------------------------------------------------------------------
// Vencimientos
// ---------------------------------------------------------------------
export interface Vencimiento {
  id: string;
  producto_id: string;
  vence: string; // YYYY-MM-DD
  cantidad: number;
  estado: "pendiente" | "vendido" | "retirado";
  nota: string;
  usuario_nombre: string;
  creado: string;
  resuelto: string | null;
  productos?: { nombre: string; codigo: string; stock: number } | null;
}

/** Días que faltan para el vencimiento (hora Argentina): 0 = vence hoy, negativo = vencido */
export function diasParaVencer(vence: string): number {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return Math.round((Date.parse(vence) - Date.parse(hoy)) / 86_400_000);
}

// ---------------------------------------------------------------------
// Mercado Pago (cobro con QR automático)
// ---------------------------------------------------------------------
export interface MpCuenta {
  comercio_id: string;
  nickname: string;
  store_nombre: string;
  external_pos_id: string;
  qr_imagen: string | null;
  qr_pdf: string | null;
  conectado: string;
}

/**
 * Medio de cobro donde se registra un pago aprobado por Mercado Pago, según cómo pagó el cliente.
 * Usa los de la plantilla "QR Mercado Pago" si están activos; si no, el QR genérico.
 */
export function medioParaPagoMP(tipo: string | null, medios: MedioConfig[]): string | null {
  const activo = (id: string) => medios.some((m) => m.id === id && m.activo);
  const candidatos =
    tipo === "account_money"
      ? ["qr_mp_cuenta"]
      : tipo === "debit_card" || tipo === "prepaid_card"
        ? ["qr_mp_debito"]
        : tipo === "credit_card"
          ? ["qr_mp_credito"]
          : [];
  const elegido =
    candidatos.find(activo) ?? (activo("qr") ? "qr" : undefined) ?? medios.find((m) => m.activo && m.grupo === "QR Mercado Pago")?.id;
  if (elegido) return elegido;
  // "qr" sin configurar también lo acepta la base (es uno de los medios básicos); si está desactivado, no hay dónde registrarlo
  return medios.some((m) => m.id === "qr") ? null : "qr";
}

export const TIPO_PAGO_MP: Record<string, string> = {
  account_money: "dinero en cuenta",
  debit_card: "débito",
  prepaid_card: "tarjeta prepaga",
  credit_card: "crédito",
};
