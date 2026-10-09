"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Suscripción en tiempo real a una colección.
 * `key` debe cambiar cuando cambian los filtros (ej: rango de fechas).
 * Pasar `enabled=false` para no suscribirse.
 */
export function useCollection<T>(path: string, constraints: QueryConstraint[] = [], key = "", enabled = true) {
  const [data, setData] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const q = query(collection(db, path), ...constraints);
    return onSnapshot(
      q,
      (s) => {
        setData(s.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setCargando(false);
        setError(null);
      },
      (e) => {
        console.error(path, e);
        setError(e.message);
        setCargando(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled]);

  return { data, cargando, error };
}
