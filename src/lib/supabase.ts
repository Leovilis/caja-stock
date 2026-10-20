import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest\/v1)?\/?$/, "");
// Acepta el nombre que muestra Supabase hoy (PUBLISHABLE_KEY) y el clásico (ANON_KEY)
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/^["']|["']$/g, "");

/** Problema de configuración detectado (se muestra en pantalla en vez de un "Invalid API key" críptico) */
export const errorConfig: string | null = !SUPABASE_URL
  ? "Falta NEXT_PUBLIC_SUPABASE_URL en .env.local"
  : !/^https?:\/\//.test(SUPABASE_URL)
    ? "NEXT_PUBLIC_SUPABASE_URL debe empezar con https://"
    : !SUPABASE_ANON_KEY
      ? "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local"
      : SUPABASE_ANON_KEY.startsWith("sb_secret_") || /service_role/.test(rolDeJwt(SUPABASE_ANON_KEY))
        ? "Pusiste la clave SECRETA (secret / service_role). Usá la publishable o la anon public."
        : null;

function rolDeJwt(k: string) {
  try {
    return JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? "";
  } catch {
    return "";
  }
}

export const supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "falta-configurar", {
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
