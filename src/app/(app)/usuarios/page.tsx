"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { KeyRound, Plus, UserCheck, UserX } from "lucide-react";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL, errMsg } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import type { Perfil, Rol } from "@/lib/types";
import { Badge, Field, Modal, PageHeader } from "@/components/ui";

export default function UsuariosPage() {
  const { perfil } = useApp();
  const { data: usuarios, recargar } = useQuery<Perfil>(() => supabase.from("perfiles").select("*").order("creado"), ["perfiles"]);
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ nombre: "", email: "", pass: "", rol: "vendedor" as Rol });
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!f.nombre.trim() || !f.email.trim() || f.pass.length < 6) return toast.error("Completá nombre, email y contraseña (mín. 6)");
    setGuardando(true);
    try {
      // Cliente aparte sin sesión persistente: crea la cuenta sin cerrar la sesión del admin
      const temp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sb-alta-temporal" },
      });
      const { data, error } = await temp.auth.signUp({ email: f.email.trim(), password: f.pass, options: { data: { nombre: f.nombre.trim() } } });
      if (error) throw error;
      if (!data.user || data.user.identities?.length === 0) throw new Error("Ese email ya está registrado");

      // El trigger de la base creó el perfil inactivo: lo habilitamos con el rol elegido
      const { error: e2 } = await supabase.from("perfiles").update({ nombre: f.nombre.trim(), rol: f.rol, activo: true }).eq("id", data.user.id);
      if (e2) throw e2;
      toast.success(data.session ? "Usuario creado" : "Usuario creado. Debe confirmar su email antes de ingresar.", { duration: 6000 });
      setNuevo(false);
      setF({ nombre: "", email: "", pass: "", rol: "vendedor" });
      recargar();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiar(u: Perfil, data: Partial<Perfil>) {
    if (u.id === perfil?.id) return toast.error("No podés modificar tu propio usuario");
    const { error } = await supabase.from("perfiles").update(data).eq("id", u.id);
    if (error) toast.error(errMsg(error));
    else toast.success("Actualizado");
  }

  const pendientes = usuarios.filter((u) => !u.activo);

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Administradores ven todo; vendedores sólo caja, ventas del día y consulta de productos">
        <button className="btn-primary" onClick={() => setNuevo(true)}>
          <Plus size={16} /> Nuevo usuario
        </button>
      </PageHeader>

      {pendientes.length > 0 && (
        <div className="card mb-4 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Hay {pendientes.length} cuenta(s) inactiva(s). Si alguien se registró por su cuenta, activalo sólo si lo conocés.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.nombre} {u.id === perfil?.id && <span className="text-xs text-slate-400">(vos)</span>}
                </td>
                <td>{u.email}</td>
                <td>
                  <select className="input w-auto py-1" value={u.rol} disabled={u.id === perfil?.id} onChange={(e) => cambiar(u, { rol: e.target.value as Rol })}>
                    <option value="admin">Administrador</option>
                    <option value="vendedor">Vendedor</option>
                  </select>
                </td>
                <td>
                  <Badge tone={u.activo ? "green" : "red"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                </td>
                <td className="whitespace-nowrap text-right">
                  <button
                    className="p-1 text-slate-400 hover:text-brand-600"
                    title="Enviar email para cambiar contraseña"
                    onClick={async () => {
                      const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/login` });
                      if (error) toast.error(errMsg(error));
                      else toast.success("Email enviado a " + u.email);
                    }}
                  >
                    <KeyRound size={16} />
                  </button>
                  {u.id !== perfil?.id && (
                    <button className="p-1 text-slate-400 hover:text-brand-600" title={u.activo ? "Desactivar" : "Activar"} onClick={() => cambiar(u, { activo: !u.activo })}>
                      {u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo usuario" size="sm">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            crear();
          }}
        >
          <Field label="Nombre">
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus />
          </Field>
          <Field label="Email (usuario de ingreso)">
            <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Contraseña inicial">
            <input className="input" type="text" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} minLength={6} />
          </Field>
          <Field label="Rol">
            <select className="input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>
          <button className="btn-primary w-full" disabled={guardando}>
            Crear
          </button>
        </form>
      </Modal>
    </div>
  );
}
