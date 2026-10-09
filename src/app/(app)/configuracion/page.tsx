"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Printer, Save, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { guardarConfig } from "@/lib/db";
import { imprimirTicket } from "@/lib/ticket";
import type { Config, Venta } from "@/lib/types";
import { Field, PageHeader } from "@/components/ui";

function ListaEditable({ titulo, items, onChange }: { titulo: string; items: string[]; onChange: (v: string[]) => void }) {
  const [nuevo, setNuevo] = useState("");
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold">{titulo}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <span key={c} className="badge gap-1 bg-slate-100 py-1 text-slate-700">
            {c}
            <button onClick={() => onChange(items.filter((x) => x !== c))} className="text-slate-400 hover:text-rose-600">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = nuevo.trim();
          if (v && !items.includes(v)) onChange([...items, v]);
          setNuevo("");
        }}
      >
        <input className="input" placeholder="Agregar…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        <button className="btn-ghost">Agregar</button>
      </form>
    </div>
  );
}

export default function ConfigPage() {
  const { config } = useApp();
  const [f, setF] = useState<Config>(config);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setF(config), [config]);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setGuardando(true);
    try {
      await guardarConfig(f);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  function prueba() {
    const v: Venta = {
      id: "prueba",
      numero: 123,
      fecha: new Date().toISOString(),
      venta_items: [
        { producto_id: "x", nombre: "Gaseosa cola 500ml", codigo: "", cantidad: 2, precio: 1500, costo: 0, subtotal: 3000, categoria: "" },
        { producto_id: "y", nombre: "Papas fritas 80g", codigo: "", cantidad: 1, precio: 1800, costo: 0, subtotal: 1800, categoria: "" },
      ],
      subtotal: 4800,
      descuento: 0,
      total: 4800,
      costo_total: 0,
      pagos: [{ medio: "efectivo", monto: 4800 }],
      recibido: 5000,
      vuelto: 200,
      caja_id: "",
      usuario_id: "",
      usuario_nombre: "Prueba",
      estado: "completada",
    };
    imprimirTicket(v, f);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configuración">
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          <Save size={16} /> Guardar cambios
        </button>
      </PageHeader>

      <div className="space-y-6">
        <div className="card grid gap-3 p-5 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Datos del negocio (aparecen en el ticket)</h3>
          <Field label="Nombre del negocio">
            <input className="input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>
          <Field label="CUIT">
            <input className="input" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <input className="input" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input className="input" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </Field>
          <Field label="Pie del ticket" className="sm:col-span-2">
            <input className="input" value={f.pie_ticket} onChange={(e) => set("pie_ticket", e.target.value)} />
          </Field>
        </div>

        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Caja e impresión</h3>
          <Field label="Ancho de la impresora térmica">
            <select className="input" value={f.ancho_ticket} onChange={(e) => set("ancho_ticket", Number(e.target.value) as 58 | 80)}>
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-ghost" onClick={prueba}>
              <Printer size={16} /> Imprimir ticket de prueba
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.imprimir_automatico} onChange={(e) => set("imprimir_automatico", e.target.checked)} />
            Imprimir ticket automáticamente al confirmar la venta
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.permitir_stock_negativo} onChange={(e) => set("permitir_stock_negativo", e.target.checked)} />
            Permitir vender sin stock (el stock queda negativo)
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Tip: en Chrome podés imprimir sin el cuadro de diálogo iniciando el navegador con <code>--kiosk-printing</code> y dejando la térmica como impresora predeterminada.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ListaEditable titulo="Categorías de productos" items={f.categorias_producto} onChange={(v) => set("categorias_producto", v)} />
          <ListaEditable titulo="Categorías de gastos" items={f.categorias_gasto} onChange={(v) => set("categorias_gasto", v)} />
        </div>
      </div>
    </div>
  );
}
