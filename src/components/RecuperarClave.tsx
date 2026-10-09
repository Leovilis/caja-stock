"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import { Modal } from "./ui";

/** Se muestra cuando el usuario entra desde el email de "olvidé mi contraseña" */
export function RecuperarClave() {
  const { recuperandoClave, finRecuperacion } = useApp();
  const [clave, setClave] = useState("");
  return (
    <Modal open={recuperandoClave} onClose={finRecuperacion} title="Elegí tu nueva contraseña" size="sm">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password: clave });
          if (error) return toast.error(error.message);
          toast.success("Contraseña actualizada");
          finRecuperacion();
        }}
      >
        <input className="input" type="password" minLength={6} required autoFocus value={clave} onChange={(e) => setClave(e.target.value)} />
        <button className="btn-primary w-full">Guardar</button>
      </form>
    </Modal>
  );
}
