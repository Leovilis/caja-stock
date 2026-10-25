"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import type { MpCuenta } from "@/lib/types";

/** Cuenta de Mercado Pago conectada del comercio (null = no conectada), en vivo */
export function useMpCuenta() {
  const { perfil } = useApp();
  const comercio = perfil?.comercio_id;
  const [cuenta, setCuenta] = useState<MpCuenta | null>(null);
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    if (!comercio) return;
    const { data } = await supabase.from("mp_cuentas").select("*").eq("comercio_id", comercio).maybeSingle();
    setCuenta((data as MpCuenta) ?? null);
    setCargando(false);
  }, [comercio]);
  useEffect(() => {
    if (!comercio) return;
    cargar();
    const ch = supabase
      .channel("mp-cuenta-" + comercio)
      .on("postgres_changes", { event: "*", schema: "public", table: "mp_cuentas", filter: `comercio_id=eq.${comercio}` }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [comercio, cargar]);
  return { cuenta, cargando, recargar: cargar };
}
