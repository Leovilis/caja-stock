"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Edit, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/hooks/useQuery";
import { borrarProveedor, guardarProveedor } from "@/lib/db";
import type { Producto, Proveedor } from "@/lib/types";
import { Empty, Field, Modal, PageHeader } from "@/components/ui";

const VACIO: Omit<Proveedor, "id"> = { nombre: "", contacto: "", telefono: "", email: "", cuit: "", dias_visita: "", notas: "" };

export default function ProveedoresPage() {
  const { data: proveedores } = useQuery<Proveedor>(() => supabase.from("proveedores").select("*"), ["proveedores"]);
  const { data: productos } = useQuery<Producto>(() => supabase.from("productos").select("id, proveedor_id"), ["productos"]);
  const [edit, setEdit] = useState<Proveedor | "nuevo" | null>(null);
  const [f, setF] = useState(VACIO);

  useEffect(() => {
    if (edit === "nuevo") setF(VACIO);
    else if (edit) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...resto } = edit;
      setF({ ...VACIO, ...resto });
    }
  }, [edit]);

  async function guardar() {
    if (!f.nombre.trim()) return toast.error("Nombre obligatorio");
    try {
      await guardarProveedor(edit === "nuevo" || !edit ? null : edit.id, { ...f, nombre: f.nombre.trim() });
      toast.success("Guardado");
      setEdit(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function borrar(p: Proveedor) {
    const n = productos.filter((x) => x.proveedor_id === p.id).length;
    if (!confirm(`¿Eliminar ${p.nombre}?${n ? ` Tiene ${n} productos asociados (quedarán sin proveedor).` : ""}`)) return;
    try {
      await borrarProveedor(p.id);
      toast.success("Eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const ordenados = [...proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div>
      <PageHeader title="Proveedores" subtitle="Distribuidoras y mayoristas">
        <button className="btn-primary" onClick={() => setEdit("nuevo")}>
          <Plus size={16} /> Nuevo
        </button>
      </PageHeader>
      {ordenados.length === 0 ? (
        <div className="card">
          <Empty>Cargá tus proveedores (Coca-Cola FEMSA, Quilmes, distribuidora de golosinas…)</Empty>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenados.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.nombre}</div>
                  {p.contacto && <div className="text-sm text-slate-500">{p.contacto}</div>}
                </div>
                <div className="flex gap-1">
                  <button className="p-1 text-slate-400 hover:text-brand-600" onClick={() => setEdit(p)}>
                    <Edit size={16} />
                  </button>
                  <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => borrar(p)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-sm text-slate-600">
                {p.telefono && (
                  <a className="flex items-center gap-1 text-brand-600" href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <Phone size={12} /> {p.telefono}
                  </a>
                )}
                {p.email && <div>{p.email}</div>}
                {p.cuit && <div>CUIT {p.cuit}</div>}
                {p.dias_visita && <div>Visita: {p.dias_visita}</div>}
                <div className="text-xs text-slate-400">{productos.filter((x) => x.proveedor_id === p.id).length} productos</div>
                {p.notas && <div className="mt-1 text-xs italic">{p.notas}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "nuevo" ? "Nuevo proveedor" : "Editar proveedor"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Field label="Nombre / Razón social" className="sm:col-span-2">
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus />
          </Field>
          <Field label="Contacto / preventista">
            <input className="input" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <input className="input" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="54 9 388 …" />
          </Field>
          <Field label="Email">
            <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="CUIT">
            <input className="input" value={f.cuit} onChange={(e) => setF({ ...f, cuit: e.target.value })} />
          </Field>
          <Field label="Días de visita / entrega" className="sm:col-span-2">
            <input className="input" value={f.dias_visita} onChange={(e) => setF({ ...f, dias_visita: e.target.value })} placeholder="Ej: martes y viernes" />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <textarea className="input" rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
              Cancelar
            </button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
