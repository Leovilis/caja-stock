// Llamadas del navegador a las rutas /api/arca/* (con el token de la sesión)
import { supabase } from "@/lib/supabase";
import type { Comprobante } from "@/lib/types";

async function llamar<T>(ruta: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión vencida: volvé a ingresar");
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: opts.method ?? "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión con el servidor");
  }
  const json = await res.json().catch(() => ({ error: `Error del servidor (HTTP ${res.status})` }));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Error"), { datos: json });
  return json as T;
}

export interface ReceptorInput {
  docTipo: number;
  docNro: number;
  condicion: number;
  nombre?: string;
  domicilio?: string;
}

export const facturar = (ventaId: string, receptor: ReceptorInput) =>
  llamar<{ comprobante: Comprobante }>("/api/arca/facturar", { body: { venta_id: ventaId, receptor } }).then((r) => r.comprobante);

export const anularConNotaCredito = (ventaId: string, motivo: string) =>
  llamar<{ ok: boolean; nota: Comprobante | null }>("/api/arca/anular", { body: { venta_id: ventaId, motivo } });

export const estadoArca = () =>
  llamar<{ ok: boolean; pasos: { paso: string; ok: boolean; detalle: string }[] }>("/api/arca/estado", { method: "GET" });
