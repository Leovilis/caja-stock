"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Building2, CalendarPlus, KeyRound, Pencil, Plus, RefreshCw, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { adminActualizarComercio, adminComercios, adminCrearComercio, adminInvitar, crearCuenta } from "@/lib/db";
import { errMsg } from "@/lib/supabase";
import { fechaHora, isoDate, money, number } from "@/lib/format";
import type { ComercioAdmin, Plan } from "@/lib/types";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Stat } from "@/components/ui";
import { CambiarClaveModal } from "@/components/CambiarClaveModal";
import { ConsultasPanel } from "@/components/ConsultasPanel";

const hoyAR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const sumarDias = (iso: string, dias: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return isoDate(d);
};
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const diasHasta = (iso: string) => Math.round((Date.parse(iso) - Date.parse(hoyAR())) / 86_400_000);

/** Estado legible de un comercio */
function estado(c: ComercioAdmin): { texto: string; tono: "green" | "amber" | "red" | "slate" | "blue" } {
  if (!c.activo) return { texto: "Suspendido", tono: "red" };
  if (!c.vence) return { texto: "Sin vencimiento", tono: "green" };
  const d = diasHasta(c.vence);
  if (d < 0) return { texto: `Vencido el ${dmy(c.vence)}`, tono: "red" };
  if (d <= 7) return { texto: d === 0 ? "Vence hoy" : `Vence en ${d} ${d === 1 ? "día" : "días"}`, tono: "amber" };
  return { texto: `Hasta el ${dmy(c.vence)}`, tono: c.plan === "basico" ? "blue" : "green" };
}

const CLAVE_CONTACTO = "cs-contacto-clientes";
const leerContacto = () => {
  try {
    return localStorage.getItem(CLAVE_CONTACTO) ?? "";
  } catch {
    return "";
  }
};
const guardarContacto = (v: string) => {
  try {
    localStorage.setItem(CLAVE_CONTACTO, v);
  } catch {
    /* sin storage */
  }
};

export default function ClientesPage() {
  const { esSuperadmin, licencia } = useApp();
  const [lista, setLista] = useState<ComercioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<ComercioAdmin | null>(null);
  const [buscar, setBuscar] = useState("");

  const recargar = useCallback(async () => {
    try {
      setLista(await adminComercios());
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (esSuperadmin) recargar();
  }, [esSuperadmin, recargar]);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return q ? lista.filter((c) => `${c.nombre} ${c.dueno ?? ""} ${c.notas}`.toLowerCase().includes(q)) : lista;
  }, [lista, buscar]);

  const resumen = useMemo(() => {
    const vencidos = lista.filter((c) => !c.activo || (c.vence && diasHasta(c.vence) < 0)).length;
    const prueba = lista.filter((c) => c.activo && c.plan === "basico" && c.vence && diasHasta(c.vence) >= 0).length;
    const porVencer = lista.filter((c) => c.activo && c.vence && diasHasta(c.vence) >= 0 && diasHasta(c.vence) <= 7).length;
    return { total: lista.length, vencidos, prueba, porVencer };
  }, [lista]);

  async function extender(c: ComercioAdmin, dias: number) {
    const base = c.vence && diasHasta(c.vence) >= 0 ? c.vence : hoyAR();
    try {
      await adminActualizarComercio({ ...c, vence: sumarDias(base, dias), activo: true });
      toast.success(`${c.nombre}: vigente hasta el ${dmy(sumarDias(base, dias))}`);
      recargar();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  if (!esSuperadmin) return <Loading />;

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Comercios que usan el sistema: plan, vencimiento y actividad. Si vos también vendés, creá tu propio comercio con otro email.">
        <button className="btn-ghost" onClick={recargar} title="Actualizar">
          <RefreshCw size={16} />
        </button>
        <button className="btn-primary" onClick={() => setNuevo(true)}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Comercios" value={resumen.total} icon={<Building2 size={16} />} />
        <Stat label="En prueba" value={resumen.prueba} tone="blue" />
        <Stat label="Vencen en 7 días" value={resumen.porVencer} tone="amber" />
        <Stat label="Vencidos / suspendidos" value={resumen.vencidos} tone="red" />
      </div>

      <ConsultasPanel />

      <div className="card overflow-x-auto">
        <div className="p-3">
          <input className="input max-w-xs" placeholder="Buscar comercio, dueño o nota…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        {cargando ? (
          <Loading />
        ) : filtrados.length === 0 ? (
          <Empty>Todavía no hay clientes. Creá el primero con «Nuevo cliente».</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Comercio</th>
                <th>Plan</th>
                <th>Estado</th>
                <th className="text-right">Ventas 30 días</th>
                <th>Última venta</th>
                <th className="text-right">Usuarios</th>
                <th className="text-right">Productos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const e = estado(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">
                        {c.nombre} {c.id === licencia.id && <span className="text-xs text-slate-400">(el tuyo)</span>}
                      </div>
                      <div className="text-xs text-slate-500">{c.dueno ?? "Sin administrador todavía (invitación pendiente)"}</div>
                      {c.notas && <div className="text-xs text-slate-400">{c.notas}</div>}
                    </td>
                    <td>
                      <Badge tone={c.plan === "completo" ? "green" : "blue"}>{c.plan === "completo" ? "Completo" : "Básico"}</Badge>
                    </td>
                    <td>
                      <Badge tone={e.tono}>{e.texto}</Badge>
                    </td>
                    <td className="text-right">
                      <div>{money(c.total_30d)}</div>
                      <div className="text-xs text-slate-500">{number(c.ventas_30d)} tickets</div>
                    </td>
                    <td className="text-sm text-slate-600">{c.ultima_venta ? fechaHora(c.ultima_venta) : "—"}</td>
                    <td className="text-right">{c.usuarios}</td>
                    <td className="text-right">{number(c.productos)}</td>
                    <td className="whitespace-nowrap text-right">
                      {c.vence && (
                        <button className="btn-ghost btn-sm" onClick={() => extender(c, 30)} title="Extender 30 días">
                          <CalendarPlus size={14} /> +30
                        </button>
                      )}
                      <button className="p-1 text-slate-400 hover:text-brand-600" onClick={() => setEditando(c)} title="Editar">
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NuevoClienteModal
        open={nuevo}
        onClose={() => setNuevo(false)}
        onListo={() => {
          setNuevo(false);
          recargar();
        }}
      />
      <EditarClienteModal
        comercio={editando}
        esPropio={editando?.id === licencia.id}
        onClose={() => setEditando(null)}
        onListo={() => {
          setEditando(null);
          recargar();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NuevoClienteModal({ open, onClose, onListo }: { open: boolean; onClose: () => void; onListo: () => void }) {
  const vacio = () => ({
    nombre: "",
    duenoNombre: "",
    duenoEmail: "",
    pass: "",
    plan: "basico" as Plan,
    vence: sumarDias(hoyAR(), 30) as string | null,
    contacto: leerContacto(),
  });
  const [f, setF] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (open) setF(vacio());
  }, [open]);

  async function crear() {
    if (!f.nombre.trim() || !f.duenoNombre.trim() || !f.duenoEmail.trim()) return toast.error("Completá comercio, nombre y email del dueño");
    setGuardando(true);
    try {
      const r = await adminCrearComercio({ ...f, nombre: f.nombre.trim(), contacto: f.contacto.trim() });
      guardarContacto(f.contacto.trim());
      if (r.ya_existia) {
        toast.success("Comercio creado. El dueño ya tenía cuenta: ingresa con su contraseña de siempre.", { duration: 7000 });
      } else if (f.pass.length >= 6) {
        const { confirmado } = await crearCuenta(f.duenoEmail, f.pass, f.duenoNombre);
        toast.success(confirmado ? "Comercio y usuario creados. Pasale el email y la contraseña." : "Comercio creado. El dueño debe confirmar su email.", {
          duration: 7000,
        });
      } else {
        toast.success("Comercio creado. Cuando el dueño se registre con ese email, queda como administrador.", { duration: 7000 });
      }
      onListo();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          crear();
        }}
      >
        <Field label="Nombre del comercio" className="sm:col-span-2">
          <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus placeholder="Ej: Kiosco Juan" />
        </Field>
        <Field label="Nombre del dueño">
          <input className="input" value={f.duenoNombre} onChange={(e) => setF({ ...f, duenoNombre: e.target.value })} />
        </Field>
        <Field label="Email del dueño (usuario de ingreso)">
          <input className="input" type="email" value={f.duenoEmail} onChange={(e) => setF({ ...f, duenoEmail: e.target.value })} />
        </Field>
        <Field label="Contraseña inicial" className="sm:col-span-2">
          <input
            className="input"
            type="text"
            value={f.pass}
            onChange={(e) => setF({ ...f, pass: e.target.value })}
            placeholder="Mín. 6. Si la dejás vacía, el dueño crea su cuenta desde «Crear cuenta» en el login"
          />
        </Field>
        <PlanVence plan={f.plan} vence={f.vence} onChange={(plan, vence) => setF({ ...f, plan, vence })} />
        <Field label="Tu contacto (aparece en los avisos de vencimiento)" className="sm:col-span-2">
          <input className="input" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} placeholder="Ej: Leo — WhatsApp 11-5555-5555" />
        </Field>
        <button className="btn-primary sm:col-span-2" disabled={guardando}>
          {guardando ? "Creando…" : "Crear cliente"}
        </button>
      </form>
    </Modal>
  );
}

/** Plan + vencimiento con atajos */
function PlanVence({ plan, vence, onChange }: { plan: Plan; vence: string | null; onChange: (plan: Plan, vence: string | null) => void }) {
  return (
    <>
      <Field label="Plan">
        <select className="input" value={plan} onChange={(e) => onChange(e.target.value as Plan, vence)}>
          <option value="basico">Básico (POS, caja, ventas, productos, stock)</option>
          <option value="completo">Completo (todo, con facturación ARCA)</option>
        </select>
      </Field>
      <Field label="Vence (último día de uso)">
        <input className="input" type="date" value={vence ?? ""} disabled={!vence} onChange={(e) => onChange(plan, e.target.value || null)} />
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {[15, 30, 90].map((d) => (
            <button key={d} type="button" className="text-brand-600 hover:underline" onClick={() => onChange(plan, sumarDias(hoyAR(), d))}>
              +{d} días
            </button>
          ))}
          <label className="flex items-center gap-1 text-slate-600">
            <input type="checkbox" checked={!vence} onChange={(e) => onChange(plan, e.target.checked ? null : sumarDias(hoyAR(), 30))} />
            Sin vencimiento
          </label>
        </div>
      </Field>
    </>
  );
}

/* ------------------------------------------------------------------ */

function EditarClienteModal({
  comercio,
  esPropio,
  onClose,
  onListo,
}: {
  comercio: ComercioAdmin | null;
  esPropio: boolean;
  onClose: () => void;
  onListo: () => void;
}) {
  const [f, setF] = useState<ComercioAdmin | null>(comercio);
  const [admin, setAdmin] = useState({ nombre: "", email: "", pass: "" });
  const [claveDueno, setClaveDueno] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setF(comercio);
    setAdmin({ nombre: "", email: "", pass: "" });
  }, [comercio]);
  if (!f) return null;

  async function guardar() {
    if (!f) return;
    setGuardando(true);
    try {
      await adminActualizarComercio(f);
      toast.success("Cliente actualizado");
      onListo();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  async function agregarAdmin() {
    if (!f || !admin.email.trim() || !admin.nombre.trim()) return toast.error("Completá nombre y email");
    setGuardando(true);
    try {
      const yaExistia = await adminInvitar(f.id, admin.email.trim(), admin.nombre.trim());
      if (!yaExistia && admin.pass.length >= 6) await crearCuenta(admin.email, admin.pass, admin.nombre);
      toast.success(yaExistia ? "Agregado: ingresa con su contraseña de siempre" : "Administrador agregado");
      onListo();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={!!comercio} onClose={onClose} title={`Editar: ${comercio?.nombre ?? ""}`}>
      <div className="space-y-5">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Field label="Nombre" className="sm:col-span-2">
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </Field>
          <PlanVence plan={f.plan} vence={f.vence} onChange={(plan, vence) => setF({ ...f, plan, vence })} />
          <Field label="Tu contacto (avisos de vencimiento)" className="sm:col-span-2">
            <input className="input" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
          </Field>
          <Field label="Notas internas (sólo las ves vos)" className="sm:col-span-2">
            <input className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej: paga el 10 de cada mes" />
          </Field>
          <label className={`flex items-center gap-2 text-sm sm:col-span-2 ${esPropio ? "opacity-50" : ""}`}>
            <input type="checkbox" checked={!f.activo} disabled={esPropio} onChange={(e) => setF({ ...f, activo: !e.target.checked })} />
            Suspender (queda en modo consulta aunque no haya vencido){esPropio && " — no podés suspender tu propio comercio"}
          </label>
          <button className="btn-primary sm:col-span-2" disabled={guardando}>
            Guardar cambios
          </button>
        </form>

        {f.dueno && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
            <span>
              Dueño: <b>{f.dueno}</b>
            </span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setClaveDueno(true)}>
              <KeyRound size={14} /> Cambiar su contraseña
            </button>
          </div>
        )}
        <CambiarClaveModal email={claveDueno ? f.dueno : null} nombre={f.nombre} propia={false} onClose={() => setClaveDueno(false)} />

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <UserPlus size={16} /> Agregar un administrador a este comercio
          </div>
          <p className="mb-2 text-xs text-slate-500">Por ejemplo, si el dueño perdió el acceso o quiere sumar a un socio. Los vendedores los da de alta el propio comercio.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" placeholder="Nombre" value={admin.nombre} onChange={(e) => setAdmin({ ...admin, nombre: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
            <input className="input" placeholder="Contraseña (mín. 6)" value={admin.pass} onChange={(e) => setAdmin({ ...admin, pass: e.target.value })} />
          </div>
          <button className="btn-ghost btn-sm mt-2" onClick={agregarAdmin} disabled={guardando}>
            <UserPlus size={14} /> Agregar
          </button>
        </div>
        <p className="text-xs text-slate-400">Cliente desde {fechaHora(f.creado)}</p>
      </div>
    </Modal>
  );
}
