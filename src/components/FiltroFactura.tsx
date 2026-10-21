"use client";

import { useEffect, useState } from "react";
import { FILTROS_FACTURA, type FiltroFactura } from "@/lib/fiscal";

const CLAVE = "cs-filtro-factura";

/** Filtro Ambas / Con factura / Sin factura, compartido entre Ventas, Compras, Reportes y Libro (se recuerda en este navegador) */
export function useFiltroFactura(): [FiltroFactura, (f: FiltroFactura) => void] {
  const [f, setF] = useState<FiltroFactura>("ambas");
  useEffect(() => {
    try {
      const v = localStorage.getItem(CLAVE) as FiltroFactura | null;
      if (v && FILTROS_FACTURA.some((x) => x.id === v)) setF(v);
    } catch {
      /* sin storage: queda "ambas" */
    }
  }, []);
  const cambiar = (v: FiltroFactura) => {
    setF(v);
    try {
      localStorage.setItem(CLAVE, v);
    } catch {
      /* nada */
    }
  };
  return [f, cambiar];
}

export function FiltroFacturaSelector({ value, onChange }: { value: FiltroFactura; onChange: (f: FiltroFactura) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="radiogroup" aria-label="Filtrar por factura">
      {FILTROS_FACTURA.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            value === o.id
              ? o.id === "con"
                ? "bg-emerald-600 text-white"
                : o.id === "sin"
                  ? "bg-slate-700 text-white"
                  : "bg-brand-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
