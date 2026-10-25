"use client";

import { useMemo } from "react";
import { useQuery } from "./useQuery";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { diasParaVencer, type Vencimiento } from "@/lib/types";

/** Vencimientos pendientes del comercio (en vivo), con los que ya vencieron y los que vencen dentro del aviso configurado */
export function useVencimientos(enabled = true) {
  const { config } = useApp();
  const { data, cargando } = useQuery<Vencimiento>(
    () => supabase.from("vencimientos").select("*, productos(nombre, codigo, stock)").eq("estado", "pendiente"),
    ["vencimientos"],
    "",
    enabled
  );
  return useMemo(() => {
    const aviso = config.dias_aviso_vencimiento ?? 7;
    const lista = [...data].sort((a, b) => a.vence.localeCompare(b.vence));
    const vencidos = lista.filter((v) => diasParaVencer(v.vence) < 0);
    const porVencer = lista.filter((v) => {
      const d = diasParaVencer(v.vence);
      return d >= 0 && d <= aviso;
    });
    return { lista, vencidos, porVencer, alertas: vencidos.length + porVencer.length, aviso, cargando };
  }, [data, cargando, config.dias_aviso_vencimiento]);
}
