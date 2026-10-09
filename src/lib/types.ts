// Tipos que reflejan las tablas de supabase/schema.sql (snake_case igual que la base)

export type Rol = "admin" | "vendedor";

export interface Perfil {
  id: string;
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
  creado?: string;
  actualizado?: string;
}

export type MedioPago = "efectivo" | "debito" | "credito" | "transferencia" | "qr";

export const MEDIOS_PAGO: { id: MedioPago; label: string }[] = [
  { id: "efectivo", label: "Efectivo" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "transferencia", label: "Transferencia" },
  { id: "qr", label: "QR / Mercado Pago" },
];

export const medioLabel = (m: string) =>
  m === "cuenta_corriente" ? "Cuenta corriente" : (MEDIOS_PAGO.find((x) => x.id === m)?.label ?? m);

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
}

export interface Pago {
  medio: MedioPago;
  monto: number;
}

export interface Venta {
  id: string;
  numero: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  costo_total: number;
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
}

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
};
