"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
// Un query builder de supabase-js (select/eq/order...) sin ejecutar
interface Consulta<T> {
  order: (col: string, opts?: { ascending?: boolean }) => Consulta<T>;
  range: (desde: number, hasta: number) => Respuesta<T>;
}

const PAGINA = 1000; // límite de filas por request de Supabase (max-rows)

/**
 * Consulta + tiempo real: ejecuta `fetcher` y vuelve a ejecutarlo cuando cambia
 * cualquiera de las tablas de `tablas` (Supabase Realtime). `key` debe cambiar
 * cuando cambian los filtros. Trae TODAS las filas paginando de a 1000
 * (Supabase corta en 1000 por defecto y los reportes quedarían incompletos).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useQuery<T>(fetcher: () => any, tablas: string[], key = "", enabled = true) {
  const [data, setData] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fRef = useRef(fetcher);
  fRef.current = fetcher;

  const pedido = useRef(0);

  const recargar = useCallback(async () => {
    const yo = ++pedido.current; // si cambian los filtros a mitad de carga, se descarta la respuesta vieja
    const filas: T[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const q = fRef.current() as Consulta<T>;
      const { data, error } = await q.order("id").range(desde, desde + PAGINA - 1);
      if (yo !== pedido.current) return;
      if (error) {
        console.error(error);
        setError(errMsg(error));
        setCargando(false);
        return;
      }
      filas.push(...(data ?? []));
      if (!data || data.length < PAGINA) break;
    }
    setData(filas);
    setError(null);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    recargar();

    let t: ReturnType<typeof setTimeout> | undefined;
    const programar = () => {
      clearTimeout(t);
      t = setTimeout(recargar, 250); // agrupa ráfagas (ej: una venta toca varias tablas)
    };
    const canal = supabase.channel(`rt-${tablas.join("-")}-${Math.random().toString(36).slice(2)}`);
    tablas.forEach((tabla) => canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, programar));
    canal.subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tablas.join(",")]);

  return { data, cargando, error, recargar };
}
