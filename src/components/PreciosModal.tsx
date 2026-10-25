"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, Percent, Upload } from "lucide-react";
import { actualizarPrecios, importarPrecios } from "@/lib/db";
import { errMsg } from "@/lib/supabase";
import { descargarCSV, parseCSV, parseNumero } from "@/lib/csv";
import { money, pct } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { Field, Modal, NumInput } from "./ui";

type Aplicar = "precio" | "costo" | "ambos";

const nuevoValor = (v: number, porc: number, redondeo: number, esPrecio: boolean) => {
  const x = v * (1 + porc / 100);
  if (esPrecio && redondeo > 0) return Math.ceil(x / redondeo) * redondeo;
  return Math.round(x * 100) / 100;
};
/** número con coma decimal (Excel en español lo toma como número) */
const num = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Cambio masivo de precios:
 *  - Por porcentaje: sobre los productos tildados o sobre una categoría/marca, con redondeo.
 *  - Con planilla: se descarga, se cambian costo/precio en Excel y se vuelve a subir (con vista previa).
 * onAplicado recibe los ids que cambiaron (para ofrecer las cenefas).
 */
export function PreciosModal({
  open,
  onClose,
  onAplicado,
  productos,
  seleccion,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  onAplicado: (ids: string[]) => void;
  productos: Producto[]; // todos los del comercio
  seleccion: Producto[]; // los tildados en la lista (puede estar vacío)
  categorias: string[];
}) {
  const [modo, setModo] = useState<"porcentaje" | "planilla">("porcentaje");
  useEffect(() => {
    if (open) setModo("porcentaje");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Actualizar precios" size="lg">
      <div className="mb-4 flex gap-2">
        <button className={modo === "porcentaje" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setModo("porcentaje")}>
          <Percent size={14} /> Por porcentaje
        </button>
        <button className={modo === "planilla" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setModo("planilla")}>
          <FileSpreadsheet size={14} /> Con planilla (Excel)
        </button>
      </div>
      {modo === "porcentaje" ? (
        <PorPorcentaje productos={productos} seleccion={seleccion} categorias={categorias} onListo={onAplicado} onClose={onClose} />
      ) : (
        <ConPlanilla productos={productos} seleccion={seleccion} onListo={onAplicado} onClose={onClose} />
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function PorPorcentaje({
  productos,
  seleccion,
  categorias,
  onListo,
  onClose,
}: {
  productos: Producto[];
  seleccion: Producto[];
  categorias: string[];
  onListo: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [alcance, setAlcance] = useState<"seleccion" | "filtro">(seleccion.length ? "seleccion" : "filtro");
  const [cat, setCat] = useState("");
  const [marca, setMarca] = useState("");
  const [porc, setPorc] = useState(10);
  const [aplicar, setAplicar] = useState<Aplicar>("precio");
  const [redondeo, setRedondeo] = useState(10);
  const [enviando, setEnviando] = useState(false);

  const marcas = useMemo(() => [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [productos]);
  const afectados = useMemo(
    () =>
      alcance === "seleccion"
        ? seleccion
        : productos.filter((p) => p.activo && (!cat || p.categoria === cat) && (!marca || p.marca === marca)),
    [alcance, seleccion, productos, cat, marca]
  );
  const tocaPrecio = aplicar !== "costo";

  async function aplicarCambio() {
    if (!porc) return toast.error("Indicá el porcentaje");
    if (!confirm(`¿${porc > 0 ? "Subir" : "Bajar"} ${Math.abs(porc)} % ${tocaPrecio ? "el precio" : "el costo"}${aplicar === "ambos" ? " y el costo" : ""} de ${afectados.length} productos?`)) return;
    setEnviando(true);
    try {
      const n = await actualizarPrecios(
        alcance === "seleccion"
          ? { ids: afectados.map((p) => p.id), porcentaje: porc, redondeo, aplicar }
          : { categoria: cat, marca, porcentaje: porc, redondeo, aplicar }
      );
      toast.success(`${n} productos actualizados`);
      onClose();
      if (tocaPrecio) onListo(afectados.map((p) => p.id));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      {seleccion.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={alcance === "seleccion"} onChange={() => setAlcance("seleccion")} />
            Los {seleccion.length} productos tildados
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={alcance === "filtro"} onChange={() => setAlcance("filtro")} />
            Por categoría / marca
          </label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {alcance === "filtro" && (
          <>
            <Field label="Categoría">
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Marca">
              <select className="input" value={marca} onChange={(e) => setMarca(e.target.value)}>
                <option value="">Todas</option>
                {marcas.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label="Porcentaje (+ aumento / − baja)">
          <NumInput value={porc} onChange={setPorc} />
        </Field>
        <Field label="Aplicar a">
          <select className="input" value={aplicar} onChange={(e) => setAplicar(e.target.value as Aplicar)}>
            <option value="precio">Sólo precio de venta</option>
            <option value="ambos">Costo y precio</option>
            <option value="costo">Sólo costo</option>
          </select>
        </Field>
        <Field label="Redondear precio hacia arriba a">
          <select className="input" value={redondeo} disabled={!tocaPrecio} onChange={(e) => setRedondeo(Number(e.target.value))}>
            <option value={0}>Sin redondeo</option>
            <option value={10}>$10</option>
            <option value={50}>$50</option>
            <option value={100}>$100</option>
          </select>
        </Field>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {afectados.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Ningún producto con esos filtros.</p>
        ) : (
          <table className="table">
            <tbody>
              {afectados.slice(0, 50).map((p) => {
                const base = tocaPrecio ? p.precio : p.costo;
                return (
                  <tr key={p.id}>
                    <td>
                      {p.nombre} {p.marca && <span className="text-xs text-slate-400">{p.marca}</span>}
                    </td>
                    <td className="text-right tabular-nums text-slate-500">{money(base)}</td>
                    <td className="text-right font-semibold tabular-nums">→ {money(nuevoValor(base, porc, redondeo, tocaPrecio))}</td>
                  </tr>
                );
              })}
              {afectados.length > 50 && (
                <tr>
                  <td colSpan={3} className="text-center text-xs text-slate-500">
                    … y {afectados.length - 50} más
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <button className="btn-primary w-full" disabled={enviando || !afectados.length || !porc} onClick={aplicarCambio}>
        {enviando ? "Aplicando…" : `Aplicar a ${afectados.length} productos`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Cambio {
  p: Producto;
  costo: number;
  precio: number;
}

function ConPlanilla({
  productos,
  seleccion,
  onListo,
  onClose,
}: {
  productos: Producto[];
  seleccion: Producto[];
  onListo: (ids: string[]) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cambios, setCambios] = useState<Cambio[] | null>(null);
  const [noEncontrados, setNoEncontrados] = useState<string[]>([]);
  const [sinCambios, setSinCambios] = useState(0);
  const [enviando, setEnviando] = useState(false);

  function descargar(lista: Producto[]) {
    descargarCSV(
      "precios",
      [...lista]
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))
        .map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, marca: p.marca, categoria: p.categoria, costo: num(p.costo), precio: num(p.precio) })),
      ["id", "codigo", "nombre", "marca", "categoria", "costo", "precio"]
    );
  }

  async function leer(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const filas = parseCSV(await archivo.text());
    if (!filas.length || !("precio" in filas[0] || "costo" in filas[0])) {
      return toast.error("La planilla tiene que tener las columnas «precio» y/o «costo» (usá la que descargaste)");
    }
    const porId = new Map(productos.map((p) => [p.id, p]));
    const porCodigo = new Map(productos.filter((p) => p.codigo).map((p) => [p.codigo, p]));
    const lista: Cambio[] = [];
    const faltan: string[] = [];
    let iguales = 0;
    for (const f of filas) {
      const p = (f.id && porId.get(f.id)) || (f.codigo && porCodigo.get(f.codigo));
      if (!p) {
        if (f.codigo || f.id || f.nombre) faltan.push(f.codigo || f.nombre || f.id);
        continue;
      }
      const costo = f.costo !== undefined && f.costo !== "" ? parseNumero(f.costo) : Number(p.costo);
      const precio = f.precio !== undefined && f.precio !== "" ? parseNumero(f.precio) : Number(p.precio);
      if (costo === Number(p.costo) && precio === Number(p.precio)) iguales++;
      else lista.push({ p, costo, precio });
    }
    setCambios(lista);
    setNoEncontrados(faltan);
    setSinCambios(iguales);
  }

  async function aplicar() {
    if (!cambios?.length) return;
    setEnviando(true);
    try {
      const r = await importarPrecios(cambios.map((c) => ({ id: c.p.id, costo: c.costo, precio: c.precio })));
      toast.success(`${r.actualizados} productos actualizados`);
      onClose();
      const conPrecioNuevo = cambios.filter((c) => c.precio !== Number(c.p.precio)).map((c) => c.p.id);
      if (conPrecioNuevo.length) onListo(conPrecioNuevo);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-1 font-semibold">1. Descargá la planilla</div>
        <p className="mb-2 text-xs text-slate-500">
          Abrila en Excel o Google Sheets y cambiá sólo las columnas <b>costo</b> y/o <b>precio</b>. No toques <b>id</b> ni <b>codigo</b>; podés borrar las filas que no
          cambian. Guardala como CSV.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={() => descargar(productos.filter((p) => p.activo))}>
            <Download size={14} /> Todos los activos
          </button>
          {seleccion.length > 0 && (
            <button className="btn-ghost btn-sm" onClick={() => descargar(seleccion)}>
              <Download size={14} /> Sólo los {seleccion.length} tildados
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 font-semibold">2. Subila con los precios nuevos</div>
        <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Elegir archivo CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={leer} />
      </div>

      {cambios && (
        <div>
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            <span className="font-semibold text-slate-700">{cambios.length} con cambios</span>
            <span className="text-slate-500">{sinCambios} sin cambios</span>
            {noEncontrados.length > 0 && (
              <span className="text-rose-700" title={noEncontrados.join(", ")}>
                {noEncontrados.length} no encontrados (se ignoran)
              </span>
            )}
          </div>
          {cambios.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Costo</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {cambios.map(({ p, costo, precio }) => {
                    const variacion = Number(p.precio) > 0 ? ((precio - Number(p.precio)) / Number(p.precio)) * 100 : 0;
                    return (
                      <tr key={p.id} className={precio < costo ? "bg-rose-50" : ""}>
                        <td>
                          {p.nombre}
                          {precio < costo && <div className="text-xs text-rose-700">¡Precio menor al costo!</div>}
                        </td>
                        <td className="whitespace-nowrap text-right tabular-nums">
                          {costo !== Number(p.costo) ? (
                            <>
                              <span className="text-slate-400 line-through">{money(p.costo)}</span> {money(costo)}
                            </>
                          ) : (
                            <span className="text-slate-500">{money(costo)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right tabular-nums">
                          {precio !== Number(p.precio) ? (
                            <>
                              <span className="text-slate-400 line-through">{money(p.precio)}</span> <b>{money(precio)}</b>
                            </>
                          ) : (
                            <span className="text-slate-500">{money(precio)}</span>
                          )}
                        </td>
                        <td className={`text-right text-xs tabular-nums ${variacion > 0 ? "text-rose-600" : variacion < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {variacion ? `${variacion > 0 ? "+" : ""}${pct(variacion)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button className="btn-primary mt-3 w-full" disabled={enviando || !cambios.length} onClick={aplicar}>
            {enviando ? "Aplicando…" : `Aplicar ${cambios.length} cambios`}
          </button>
        </div>
      )}
    </div>
  );
}
