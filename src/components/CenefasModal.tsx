"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Printer } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { imprimirCenefas, precioCenefa, type TamanoCenefa } from "@/lib/cenefas";
import { isoDate, parseIsoDate } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { Field, Modal } from "./ui";

type Origen = "cambiados" | "todos" | "favoritos";

/** Elegir e imprimir cenefas (etiquetas de precio para la góndola) */
export function CenefasModal({
  open,
  onClose,
  productos,
  categorias,
  desdeInicial,
}: {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
  categorias: string[];
  /** si viene, arranca en "precios cambiados desde" esa fecha (ej: después de un aumento) */
  desdeInicial?: string;
}) {
  const { config } = useApp();
  const [origen, setOrigen] = useState<Origen>("cambiados");
  const [desde, setDesde] = useState(isoDate(new Date()));
  const [cat, setCat] = useState("");
  const [tamano, setTamano] = useState<TamanoCenefa>("mediana");
  const [mostrarCodigo, setMostrarCodigo] = useState(true);
  const [mostrarFecha, setMostrarFecha] = useState(true);
  const [mostrarComercio, setMostrarComercio] = useState(false);
  const [quitados, setQuitados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setQuitados(new Set());
    if (desdeInicial) {
      setOrigen("cambiados");
      setDesde(desdeInicial);
    }
  }, [open, desdeInicial]);

  const candidatos = useMemo(() => {
    const ini = parseIsoDate(desde).getTime();
    return productos
      .filter((p) => p.activo && p.precio > 0)
      .filter((p) => !cat || p.categoria === cat)
      .filter((p) =>
        origen === "favoritos" ? p.favorito : origen === "cambiados" ? new Date(p.precio_desde ?? p.actualizado ?? 0).getTime() >= ini : true
      )
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  }, [productos, origen, desde, cat]);
  const elegidos = candidatos.filter((p) => !quitados.has(p.id));

  const alternar = (id: string) =>
    setQuitados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Modal open={open} onClose={onClose} title="Imprimir cenefas" size="lg">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="¿Cuáles?">
          <select className="input" value={origen} onChange={(e) => setOrigen(e.target.value as Origen)}>
            <option value="cambiados">Precios cambiados desde…</option>
            <option value="todos">Todos los productos</option>
            <option value="favoritos">Sólo favoritos</option>
          </select>
        </Field>
        {origen === "cambiados" ? (
          <Field label="Desde">
            <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value || isoDate(new Date()))} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Categoría">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tamaño">
          <select className="input" value={tamano} onChange={(e) => setTamano(e.target.value as TamanoCenefa)}>
            <option value="chica">Chica (4 por fila)</option>
            <option value="mediana">Mediana (3 por fila)</option>
            <option value="grande">Grande (2 por fila)</option>
          </select>
        </Field>
        <div className="flex flex-col justify-end gap-1 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mostrarCodigo} onChange={(e) => setMostrarCodigo(e.target.checked)} /> Mostrar código
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mostrarFecha} onChange={(e) => setMostrarFecha(e.target.checked)} /> Mostrar fecha de impresión
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mostrarComercio} onChange={(e) => setMostrarComercio(e.target.checked)} /> Mostrar nombre del comercio
          </label>
        </div>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
        {candidatos.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">
            {origen === "cambiados" ? "Ningún precio cambió desde esa fecha." : "No hay productos para esos filtros."}
          </p>
        ) : (
          <table className="table">
            <tbody>
              {candidatos.map((p) => (
                <tr key={p.id} className={quitados.has(p.id) ? "opacity-40" : ""}>
                  <td className="w-8">
                    <input type="checkbox" checked={!quitados.has(p.id)} onChange={() => alternar(p.id)} />
                  </td>
                  <td>
                    {p.nombre} <span className="text-xs text-slate-400">{p.categoria}</span>
                  </td>
                  <td className="text-right font-semibold tabular-nums">{precioCenefa(p.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-500">
          {elegidos.length} cenefa{elegidos.length === 1 ? "" : "s"} · hoja A4
        </span>
        <button
          className="btn-primary"
          disabled={!elegidos.length}
          onClick={() => {
            imprimirCenefas(elegidos, config, { tamano, mostrarCodigo, mostrarFecha, mostrarComercio });
            toast.success("Elegí la impresora común (A4). Recortá por la línea punteada.", { duration: 5000 });
          }}
        >
          <Printer size={16} /> Imprimir
        </button>
      </div>
    </Modal>
  );
}
