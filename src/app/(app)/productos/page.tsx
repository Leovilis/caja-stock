"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Download, Edit, Plus, Star, TrendingUp, Upload, PackageMinus, Trash2, Tags } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { actualizarProducto, crearProducto, eliminarProducto, importarProductos, type ProductoInput } from "@/lib/db";
import { money, number, margen, round2, pct, isoDate } from "@/lib/format";
import { descargarCSV, parseCSV, parseNumero } from "@/lib/csv";
import type { Producto, Proveedor } from "@/lib/types";
import { Badge, Empty, Field, Loading, Modal, NumInput, PageHeader } from "@/components/ui";
import { AjusteStockModal } from "@/components/AjusteStockModal";
import { CenefasModal } from "@/components/CenefasModal";
import { PreciosModal } from "@/components/PreciosModal";
import { ALICUOTAS } from "@/lib/arca/calculo";

const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ProductosPage() {
  const { esAdmin, config } = useApp();
  const { data: productos, cargando } = useQuery<Producto>(() => supabase.from("productos").select("*").order("nombre"), ["productos"]);
  const { data: proveedores } = useQuery<Proveedor>(() => supabase.from("proveedores").select("*").order("nombre"), ["proveedores"], "", esAdmin);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [filtro, setFiltro] = useState<"activos" | "bajo" | "sin" | "inactivos" | "todos">("activos");
  const [editando, setEditando] = useState<Producto | null | "nuevo">(null);
  const [ajustando, setAjustando] = useState<Producto | null>(null);
  const [masivo, setMasivo] = useState(false);
  const [cenefas, setCenefas] = useState<{ desde?: string; ids?: string[] } | null>(null);
  const [tildados, setTildados] = useState<Set<string>>(new Set());
  const seleccion = useMemo(() => productos.filter((p) => tildados.has(p.id)), [productos, tildados]);
  const tildar = (id: string) =>
    setTildados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const fileRef = useRef<HTMLInputElement>(null);

  async function eliminar(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"?\n\nSi ya tuvo ventas o movimientos de stock no se borra: queda desactivado (no aparece en la caja, pero los reportes y tickets viejos lo conservan).`)) return;
    try {
      const r = await eliminarProducto(p.id);
      if (r === "eliminado") toast.success(`"${p.nombre}" eliminado`);
      else toast.success(`"${p.nombre}" tenía historial: quedó desactivado. Lo ves en el filtro «Inactivos».`, { duration: 6000 });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const lista = useMemo(() => {
    const palabras = norm(q).split(/\s+/).filter(Boolean);
    return productos
      .filter((p) => {
        if (filtro === "activos" && !p.activo) return false;
        if (filtro === "inactivos" && p.activo) return false;
        if (filtro === "bajo" && !(p.activo && p.stock <= p.stock_min && p.stock > 0)) return false;
        if (filtro === "sin" && !(p.activo && p.stock <= 0)) return false;
        if (cat && p.categoria !== cat) return false;
        const t = norm(`${p.nombre} ${p.codigo} ${p.marca ?? ""}`);
        return palabras.every((w) => t.includes(w));
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, q, cat, filtro]);

  const categorias = useMemo(
    () => [...new Set([...config.categorias_producto, ...productos.map((p) => p.categoria).filter(Boolean)])].sort(),
    [config.categorias_producto, productos]
  );

  const valorizado = useMemo(
    () => productos.filter((p) => p.activo && p.stock > 0).reduce((a, p) => ({ costo: a.costo + p.costo * p.stock, venta: a.venta + p.precio * p.stock }), { costo: 0, venta: 0 }),
    [productos]
  );

  function exportar() {
    descargarCSV(
      `productos-${new Date().toISOString().slice(0, 10)}`,
      lista.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria,
        marca: p.marca ?? "",
        costo: String(p.costo).replace(".", ","),
        precio: String(p.precio).replace(".", ","),
        stock: p.stock,
        stockmin: p.stock_min,
        iva: String(p.alicuota_iva ?? 21).replace(".", ","),
        activo: p.activo ? "si" : "no",
      }))
    );
  }

  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const filas = parseCSV(await f.text());
    const validas = filas
      .filter((r) => r.nombre)
      .map(
        (r): Partial<ProductoInput> => ({
          codigo: (r.codigo ?? "").trim(),
          nombre: r.nombre.trim(),
          categoria: r.categoria || "Varios",
          marca: r.marca ?? "",
          costo: parseNumero(r.costo),
          precio: parseNumero(r.precio),
          stock: parseNumero(r.stock),
          stock_min: parseNumero(r.stockmin ?? r.stock_min ?? r["stock minimo"]),
          activo: (r.activo ?? "si").toLowerCase() !== "no",
          ...(r.iva ? { alicuota_iva: parseNumero(r.iva) } : {}),
        })
      );
    if (!validas.length) return toast.error("El archivo no tiene filas válidas (columna 'nombre' obligatoria)");
    if (!confirm(`Se procesarán ${validas.length} productos. Los códigos existentes se actualizan (nombre, categoría, costo, precio, stock mínimo). ¿Continuar?`)) return;
    const t = toast.loading("Importando…");
    try {
      const r = await importarProductos(validas);
      toast.success(`${r.creados} creados · ${r.actualizados} actualizados`, { id: t });
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    }
  }

  return (
    <div>
      <PageHeader title="Productos" subtitle={`${productos.filter((p) => p.activo).length} activos${esAdmin ? ` · Stock valorizado: ${money(valorizado.costo)} al costo / ${money(valorizado.venta)} a precio de venta` : ""}`}>
        {esAdmin && (
          <>
            <button className="btn-ghost" onClick={() => setMasivo(true)}>
              <TrendingUp size={16} /> Actualizar precios{tildados.size > 0 && ` (${tildados.size})`}
            </button>
            <button className="btn-ghost" onClick={() => setCenefas(tildados.size ? { ids: [...tildados] } : {})}>
              <Tags size={16} /> Cenefas
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importar} />
            <button className="btn-ghost" onClick={exportar}>
              <Download size={16} /> Exportar
            </button>
            <button className="btn-primary" onClick={() => setEditando("nuevo")}>
              <Plus size={16} /> Nuevo
            </button>
          </>
        )}
      </PageHeader>

      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        <input className="input max-w-xs flex-1" placeholder="Buscar por nombre, código o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="activos">Activos</option>
          <option value="bajo">Stock bajo</option>
          <option value="sin">Sin stock</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {esAdmin && tildados.size > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-2 border-brand-100 bg-brand-50 p-3 text-sm">
          <b>{tildados.size} tildados</b>
          <button className="btn-primary btn-sm" onClick={() => setMasivo(true)}>
            <TrendingUp size={14} /> Cambiar precio por %
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setCenefas({ ids: [...tildados] })}>
            <Tags size={14} /> Cenefas
          </button>
          <button className="ml-auto text-xs text-slate-500 hover:text-brand-600" onClick={() => setTildados(new Set())}>
            Quitar selección
          </button>
        </div>
      )}
      {esAdmin && tildados.size === 0 && (
        <p className="mb-2 text-xs text-slate-500">
          Tip: buscá (ej. «coca»), tildá todos con la casilla del encabezado y cambiá el precio de todos juntos.
        </p>
      )}

      <div className="card overflow-x-auto">
        {cargando ? (
          <Loading />
        ) : lista.length === 0 ? (
          <Empty>No hay productos para mostrar</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {esAdmin && (
                  <th className="w-8">
                    <input
                      type="checkbox"
                      title="Tildar todos los que se ven"
                      checked={lista.length > 0 && lista.every((p) => tildados.has(p.id))}
                      onChange={(e) =>
                        setTildados((s) => {
                          const n = new Set(s);
                          lista.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id)));
                          return n;
                        })
                      }
                    />
                  </th>
                )}
                <th></th>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                {esAdmin && <th className="text-right">Costo</th>}
                <th className="text-right">Precio</th>
                {esAdmin && <th className="text-right">Margen</th>}
                <th className="text-right">Stock</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className={`${p.activo ? "" : "opacity-50"} ${tildados.has(p.id) ? "bg-brand-50" : ""}`}>
                  {esAdmin && (
                    <td>
                      <input type="checkbox" checked={tildados.has(p.id)} onChange={() => tildar(p.id)} />
                    </td>
                  )}
                  <td>
                    <button
                      disabled={!esAdmin}
                      onClick={() => actualizarProducto(p.id, { favorito: !p.favorito })}
                      title="Favorito en la caja"
                      className={p.favorito ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}
                    >
                      <Star size={16} fill={p.favorito ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{p.codigo || "—"}</td>
                  <td className="font-medium">
                    {p.nombre}
                    {p.marca && <span className="ml-1 text-xs text-slate-400">{p.marca}</span>}
                  </td>
                  <td className="text-slate-500">{p.categoria}</td>
                  {esAdmin && <td className="text-right tabular-nums">{money(p.costo)}</td>}
                  <td className="text-right font-semibold tabular-nums">{money(p.precio)}</td>
                  {esAdmin && <td className="text-right text-xs tabular-nums text-slate-500">{pct(margen(p.costo, p.precio))}</td>}
                  <td className="text-right">
                    <Badge tone={p.stock <= 0 ? "red" : p.stock <= p.stock_min ? "amber" : "slate"}>{number(p.stock)}</Badge>
                  </td>
                  {esAdmin && (
                    <td className="whitespace-nowrap text-right">
                      <button className="p-1 text-slate-400 hover:text-brand-600" title="Ajustar stock" onClick={() => setAjustando(p)}>
                        <PackageMinus size={16} />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-brand-600" title="Editar" onClick={() => setEditando(p)}>
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-rose-600" title="Eliminar" onClick={() => eliminar(p)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {esAdmin && (
        <p className="mt-3 text-xs text-slate-500">
          Importación CSV: columnas <code>codigo; nombre; categoria; marca; costo; precio; stock; stockmin; activo; iva</code>. Separador ; o , — exportá primero para usar como plantilla.
        </p>
      )}

      <ProductoModal
        producto={editando}
        onClose={() => setEditando(null)}
        categorias={categorias}
        proveedores={proveedores}
        productos={productos}
      />
      <AjusteStockModal producto={ajustando} onClose={() => setAjustando(null)} />
      <PreciosModal
        open={masivo}
        onClose={() => setMasivo(false)}
        onAplicado={(ids) => {
          setTildados(new Set());
          setCenefas({ ids, desde: isoDate(new Date()) });
        }}
        productos={productos}
        seleccion={seleccion}
        categorias={categorias}
      />
      <CenefasModal
        open={!!cenefas}
        onClose={() => setCenefas(null)}
        productos={productos}
        categorias={categorias}
        desdeInicial={cenefas?.desde}
        soloIds={cenefas?.ids}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const VACIO: ProductoInput = {
  nombre: "",
  codigo: "",
  categoria: "",
  marca: "",
  costo: 0,
  precio: 0,
  stock: 0,
  stock_min: 0,
  proveedor_id: null,
  activo: true,
  favorito: false,
  alicuota_iva: 21,
};

function ProductoModal({
  producto,
  onClose,
  categorias,
  proveedores,
  productos,
}: {
  producto: Producto | null | "nuevo";
  onClose: () => void;
  categorias: string[];
  proveedores: Proveedor[];
  productos: Producto[];
}) {
  const { modulo } = useApp();
  const [f, setF] = useState<ProductoInput>(VACIO);
  const [markup, setMarkup] = useState(40);
  const [guardando, setGuardando] = useState(false);
  const esNuevo = producto === "nuevo";

  useEffect(() => {
    if (producto === "nuevo") {
      setF({ ...VACIO, categoria: categorias[0] ?? "Varios" });
      setMarkup(40);
    } else if (producto) {
      const { id, ...rest } = producto;
      void id;
      setF({ ...VACIO, ...rest });
      setMarkup(Math.round(margen(producto.costo, producto.precio)));
    }
  }, [producto, categorias]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    if (!f.nombre.trim()) return toast.error("El nombre es obligatorio");
    if (f.precio <= 0) return toast.error("Ingresá el precio de venta");
    const codigo = f.codigo.trim();
    if (codigo) {
      const dup = productos.find((p) => p.codigo === codigo && (esNuevo || p.id !== (producto as Producto).id));
      if (dup) return toast.error(`El código ya lo usa "${dup.nombre}"`);
    }
    setGuardando(true);
    try {
      const data = { ...f, codigo, nombre: f.nombre.trim() };
      if (esNuevo) await crearProducto(data);
      else await actualizarProducto((producto as Producto).id, data);
      toast.success("Producto guardado");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={!!producto} onClose={onClose} title={esNuevo ? "Nuevo producto" : "Editar producto"} size="lg">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label="Nombre" className="sm:col-span-2">
          <input className="input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus placeholder="Ej: Coca-Cola 500ml" />
        </Field>
        <Field label="Código de barras / interno">
          <div className="flex gap-2">
            <input
              className="input font-mono"
              value={f.codigo}
              onChange={(e) => set("codigo", e.target.value)}
              placeholder="Escanealo acá"
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            />
            <button type="button" className="btn-ghost btn-sm whitespace-nowrap" onClick={() => set("codigo", "INT" + Date.now().toString().slice(-7))}>
              Generar
            </button>
          </div>
        </Field>
        <Field label="Marca">
          <input className="input" value={f.marca} onChange={(e) => set("marca", e.target.value)} />
        </Field>
        <Field label="Categoría">
          <input className="input" list="cats" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} />
          <datalist id="cats">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {modulo("proveedores") && (
          <Field label="Proveedor">
            <select className="input" value={f.proveedor_id ?? ""} onChange={(e) => set("proveedor_id", e.target.value || null)}>
              <option value="">—</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-2">
          <Field label="Costo">
            <NumInput
              value={f.costo}
              onChange={(n) => {
                set("costo", n);
                if (n > 0) set("precio", Math.ceil((n * (1 + markup / 100)) / 10) * 10);
              }}
            />
          </Field>
          <Field label="Margen %">
            <NumInput
              value={markup}
              onChange={(n) => {
                setMarkup(n);
                if (f.costo > 0) set("precio", Math.ceil((f.costo * (1 + n / 100)) / 10) * 10);
              }}
            />
          </Field>
          <Field label="Precio venta">
            <NumInput
              value={f.precio}
              onChange={(n) => {
                set("precio", n);
                if (f.costo > 0) setMarkup(round2(margen(f.costo, n)));
              }}
            />
          </Field>
          <p className="col-span-3 text-xs text-slate-500">Al cargar costo o margen, el precio se redondea a $10 hacia arriba. Podés editarlo a mano.</p>
        </div>

        {esNuevo ? (
          <Field label="Stock inicial">
            <NumInput value={f.stock} onChange={(n) => set("stock", n)} />
          </Field>
        ) : (
          <Field label="Stock actual">
            <div className="input bg-slate-50 text-slate-500">{number(f.stock)} (se modifica con ajustes o compras)</div>
          </Field>
        )}
        <Field label="Stock mínimo (alerta)">
          <NumInput value={f.stock_min} onChange={(n) => set("stock_min", n)} />
        </Field>
        {modulo("facturacion") && (
          <Field label="IVA (para factura A/B)">
            <select className="input" value={f.alicuota_iva} onChange={(e) => set("alicuota_iva", Number(e.target.value))}>
              {ALICUOTAS.map((a) => (
                <option key={a} value={a}>
                  {String(a).replace(".", ",")} %
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} /> Activo (visible en la caja)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.favorito} onChange={(e) => set("favorito", e.target.checked)} /> Favorito (acceso rápido)
          </label>
        </div>

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={guardando}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

