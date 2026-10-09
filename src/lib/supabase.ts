import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Mensaje legible de un error de Supabase/Postgres (los RAISE EXCEPTION de las funciones) */
export function errMsg(e: unknown): string {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes("duplicate key") && m.includes("productos_codigo_uk")) return "Ese código de barras ya existe";
  return m;
}

/** Ejecuta una función RPC y lanza Error con el mensaje de la base si falla */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errMsg(error));
  return data as T;
}
