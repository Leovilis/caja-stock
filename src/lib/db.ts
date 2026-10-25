// Acceso a datos. La lógica que mueve stock o plata vive en funciones de Postgres
// (supabase/schema.sql) que corren atómicas en el servidor; acá sólo las invocamos.
import { createClient } from "@supabase/supabase-js";
import { rpc, supabase, errMsg, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import type { ComercioAdmin, Plan } from "./types";
import type { Caja, Config, MedioPago, MovimientoCaja, Pago, Producto, Proveedor, TipoFacturaCompra, Venta } from "./types";
import { round2 } from "./format";

const check = <T>(r: { data: T; error: unknown }) => {
  if (r.error) throw new Error(errMsg(r.error));
  return r.data;
};

/* CONFIG ------------------------------------------------------------- */
export async function guardarConfig(cfg: Config) {
  // la fila es la del comercio del usuario (RLS); comercio_id no se modifica
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { comercio_id, ...datos } = cfg as Config & { comercio_id?: string; id?: number };
  if (!comercio_id) throw new Error("No se encontró la configuración del comercio");
  check(await supabase.from("config").update(datos).eq("comercio_id", comercio_id));
}

/* USUARIOS ----------------------------------------------------------- */
/** Registra la invitación en la base. true = la cuenta ya existía y quedó agregada (no hay que crearla). */
export const invitarUsuario = (email: string, nombre: string, rol: "admin" | "vendedor") =>
  rpc<boolean>("invitar_usuario", { p_email: email, p_nombre: nombre, p_rol: rol });

/* ADMINISTRADOR GENERAL ---------------------------------------------- */
export const adminComercios = () => rpc<ComercioAdmin[]>("admin_comercios");
export const adminCrearComercio = (c: { nombre: string; plan: Plan; vence: string | null; contacto: string; duenoEmail: string; duenoNombre: string }) =>
  rpc<{ id: string; ya_existia: boolean }>("admin_crear_comercio", {
    p_nombre: c.nombre,
    p_plan: c.plan,
    p_vence: c.vence,
    p_contacto: c.contacto,
    p_dueno_email: c.duenoEmail,
    p_dueno_nombre: c.duenoNombre,
  });
export const adminActualizarComercio = (c: Pick<ComercioAdmin, "id" | "nombre" | "plan" | "vence" | "activo" | "contacto" | "notas">) =>
  rpc<void>("admin_actualizar_comercio", {
    p_id: c.id,
    p_nombre: c.nombre,
    p_plan: c.plan,
    p_vence: c.vence,
    p_activo: c.activo,
    p_contacto: c.contacto,
    p_notas: c.notas,
  });
export const adminInvitar = (comercio: string, email: string, nombre: string) =>
  rpc<boolean>("admin_invitar", { p_comercio: comercio, p_email: email, p_nombre: nombre });

/** Crea la cuenta (email + contraseña) sin cerrar la sesión actual. La base la asocia por la invitación. */
export async function crearCuenta(email: string, pass: string, nombre: string) {
  const temp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sb-alta-temporal" },
  });
  const { data, error } = await temp.auth.signUp({ email: email.trim(), password: pass, options: { data: { nombre: nombre.trim() } } });
  if (error) throw new Error(errMsg(error));
  if (!data.user || data.user.identities?.length === 0) throw new Error("Ese email ya está registrado");
  return { confirmado: !!data.session };
}

/* VENTAS ------------------------------------------------------------- */
export interface ItemCarrito {
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  precio: number;
}

export function registrarVenta(items: ItemCarrito[], descuento: number, pagos: Pago[], recibido: number, vuelto: number) {
  return rpc<Venta>("registrar_venta", {
    p_items: items.map((i) =>
      i.producto_id ? { producto_id: i.producto_id, cantidad: i.cantidad } : { producto_id: null, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }
    ),
    p_descuento: descuento,
    p_pagos: pagos,
    p_recibido: recibido,
    p_vuelto: vuelto,
  });
}

export const anularVenta = (id: string, motivo: string) => rpc("anular_venta", { p_venta: id, p_motivo: motivo });

/* PRODUCTOS ---------------------------------------------------------- */
export type ProductoInput = Omit<Producto, "id" | "creado" | "actualizado">;

export const crearProducto = (p: ProductoInput) => rpc<string>("crear_producto", { p });

export async function actualizarProducto(id: string, data: Partial<Producto>) {
  // el stock no se edita a mano: sólo con movimientos
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stock, id: _id, creado, actualizado, ...resto } = data;
  check(await supabase.from("productos").update({ ...resto, actualizado: new Date().toISOString() }).eq("id", id));
}

export const moverStock = (productoId: string, tipo: "ajuste" | "compra" | "merma" | "vencido", valor: number, motivo: string) =>
  rpc<number>("mover_stock", { p_producto: productoId, p_tipo: tipo, p_valor: valor, p_motivo: motivo });

export const aumentarPrecios = (porcentaje: number, categoria: string, redondeo: number, aplicar: "precio" | "costo" | "ambos") =>
  rpc<number>("aumentar_precios", { p_porcentaje: porcentaje, p_categoria: categoria, p_redondeo: redondeo, p_aplicar: aplicar });

export const importarProductos = (filas: Partial<ProductoInput>[]) =>
  rpc<{ creados: number; actualizados: number }>("importar_productos", { p_filas: filas });

/* PROVEEDORES -------------------------------------------------------- */
export async function guardarProveedor(id: string | null, data: Omit<Proveedor, "id">) {
  if (id) check(await supabase.from("proveedores").update(data).eq("id", id));
  else check(await supabase.from("proveedores").insert(data));
}
export async function borrarProveedor(id: string) {
  check(await supabase.from("proveedores").delete().eq("id", id));
}

/* COMPRAS ------------------------------------------------------------ */
export interface NuevaCompra {
  proveedor_id: string;
  comprobante: string;
  medio: MedioPago | "cuenta_corriente";
  pagado_desde_caja: boolean;
  actualizar_costo: boolean;
  mantener_margen: boolean;
  items: { producto_id: string; cantidad: number; costo: number }[];
  fac_tipo: TipoFacturaCompra;
  fac_iva: number;
}
export const registrarCompra = (c: NuevaCompra) => rpc<string>("registrar_compra", { p: c });
export const datosFacturaCompra = (id: string, tipo: TipoFacturaCompra, numero: string, iva: number) =>
  rpc<void>("datos_factura_compra", { p_compra: id, p_tipo: tipo, p_numero: numero, p_iva: iva });

/* GASTOS ------------------------------------------------------------- */
export const registrarGasto = (g: {
  fecha: string;
  categoria: string;
  descripcion: string;
  monto: number;
  medio: MedioPago;
  desdeCaja: boolean;
}) =>
  rpc<string>("registrar_gasto", {
    p_fecha: g.fecha,
    p_categoria: g.categoria,
    p_descripcion: g.descripcion,
    p_monto: g.monto,
    p_medio: g.medio,
    p_desde_caja: g.desdeCaja,
  });

export async function borrarGasto(id: string) {
  check(await supabase.from("gastos").delete().eq("id", id));
}

/* CAJA --------------------------------------------------------------- */
export const abrirCaja = (monto: number) => rpc<string>("abrir_caja", { p_monto: monto });
export const movimientoCaja = (tipo: "ingreso" | "egreso", monto: number, concepto: string) =>
  rpc<string>("movimiento_caja", { p_tipo: tipo, p_monto: monto, p_concepto: concepto });
export const cerrarCaja = (id: string, contado: number, obs: string) => rpc<Caja>("cerrar_caja", { p_caja: id, p_contado: contado, p_obs: obs });

export interface ResumenCaja {
  cantVentas: number;
  cantAnuladas: number;
  totalVentas: number;
  porMedio: Record<string, number>;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
  ganancia: number;
}

/** Resumen en vivo del turno (el cierre definitivo lo calcula la base) */
export function calcularResumen(caja: Pick<Caja, "monto_inicial">, ventas: Venta[], movs: MovimientoCaja[]): ResumenCaja {
  const ok = ventas.filter((v) => v.estado === "completada");
  const porMedio: Record<string, number> = {};
  ok.forEach((v) => v.pagos.forEach((p) => (porMedio[p.medio] = round2((porMedio[p.medio] ?? 0) + Number(p.monto)))));
  const ingresos = round2(movs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto), 0));
  const egresos = round2(movs.filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.monto), 0));
  const totalVentas = round2(ok.reduce((a, v) => a + Number(v.total), 0));
  return {
    cantVentas: ok.length,
    cantAnuladas: ventas.length - ok.length,
    totalVentas,
    porMedio,
    ingresos,
    egresos,
    efectivoEsperado: round2(Number(caja.monto_inicial) + (porMedio.efectivo ?? 0) + ingresos - egresos),
    ganancia: round2(ok.reduce((a, v) => a + Number(v.total) - Number(v.costo_total), 0)),
  };
}
