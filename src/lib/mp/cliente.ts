// Llamadas del navegador a /api/mp/* (con el token de la sesión)
import { llamar } from "@/lib/arca/cliente";
import type { MpCuenta } from "@/lib/types";

export interface SucursalOpcion {
  id: string;
  nombre: string;
  direccion: string;
}
export interface DatosSucursal {
  nombre: string;
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  latitud: number;
  longitud: number;
}

export const mpConectar = (body: { token: string; store_id?: string; store_nombre?: string; sucursal?: DatosSucursal }) =>
  llamar<{ paso: "sucursal"; nickname: string; pais: string; sucursales: SucursalOpcion[] } | { paso: "listo"; cuenta: MpCuenta }>("/api/mp/cuenta", {
    body,
  });
export const mpDesconectar = () => llamar<{ ok: boolean }>("/api/mp/cuenta", { method: "DELETE" });

export type EstadoCobroMP = "pendiente" | "aprobado" | "cancelado" | "vencido" | "rechazado";
export const mpCrearCobro = (monto: number) =>
  llamar<{ id: string; order_id: string; qr_data: string | null; qr_imagen: string | null }>("/api/mp/cobro", { body: { monto } });
export const mpEstadoCobro = (id: string) =>
  llamar<{ estado: EstadoCobroMP; tipo_pago: string | null; order_id: string }>(`/api/mp/cobro?id=${encodeURIComponent(id)}`, { method: "GET" });
export const mpCancelarCobro = (id: string) =>
  llamar<{ estado: EstadoCobroMP; tipo_pago: string | null; order_id: string }>(`/api/mp/cobro?id=${encodeURIComponent(id)}`, { method: "DELETE" });
