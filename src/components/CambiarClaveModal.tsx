"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { cambiarClave } from "@/lib/db";
import { supabase, errMsg } from "@/lib/supabase";
import { Field, Modal } from "./ui";

/**
 * Cambiar contraseña.
 *  - propia: pide la actual.
 *  - de otro usuario (admin de su comercio / administrador general): pone una nueva y cierra sus sesiones.
 */
export function CambiarClaveModal({
  email,
  nombre,
  propia,
  permitirEmail = true,
  onClose,
}: {
  email: string | null; // null = cerrado
  nombre?: string;
  propia: boolean;
  /** ofrecer "mandarle el email para que la elija" (no para vendedores: su clave la maneja el admin) */
  permitirEmail?: boolean;
  onClose: () => void;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setActual("");
    setNueva("");
    setRepetir("");
    setVer(false);
  }, [email]);

  async function guardar() {
    if (!email) return;
    if (nueva.length < 6) return toast.error("La contraseña nueva debe tener al menos 6 caracteres");
    if (nueva !== repetir) return toast.error("Las contraseñas nuevas no coinciden");
    if (propia && !actual) return toast.error("Ingresá tu contraseña actual");
    setGuardando(true);
    try {
      await cambiarClave(email, nueva, propia ? actual : undefined);
      toast.success(propia ? "Tu contraseña se cambió" : `Contraseña de ${nombre || email} cambiada. Pasásela para que ingrese.`, { duration: 6000 });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  async function enviarEmail() {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    if (error) toast.error(errMsg(error));
    else toast.success("Email enviado a " + email);
  }

  const tipo = ver ? "text" : "password";
  return (
    <Modal open={!!email} onClose={onClose} title={propia ? "Cambiar mi contraseña" : `Contraseña de ${nombre || email}`} size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        {!propia && <p className="text-xs text-slate-500">{email} · se cerrarán sus sesiones abiertas y tendrá que ingresar con la nueva.</p>}
        {propia && (
          <Field label="Contraseña actual">
            <input className="input" type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} autoFocus autoComplete="current-password" />
          </Field>
        )}
        <Field label="Contraseña nueva">
          <input className="input" type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus={!propia} autoComplete="new-password" />
        </Field>
        <Field label="Repetir contraseña nueva">
          <input className="input" type={tipo} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <button type="button" onClick={() => setVer(!ver)} className="text-slate-500 hover:text-brand-600">
            {ver ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {ver ? "Ocultar" : "Mostrar"} contraseñas
        </label>
        <button className="btn-primary w-full" disabled={guardando}>
          {guardando ? "Guardando…" : "Cambiar contraseña"}
        </button>
        {!propia && permitirEmail && (
          <button type="button" onClick={enviarEmail} className="w-full text-center text-xs text-slate-500 hover:text-brand-600">
            o enviarle un email para que la elija él/ella
          </button>
        )}
      </form>
    </Modal>
  );
}
