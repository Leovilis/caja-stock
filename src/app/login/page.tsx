"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";

const traducir = (m: string) =>
  /invalid api key/i.test(m)
    ? "Clave de Supabase inválida: revisá NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local y reiniciá npm run dev"
    : m.includes("Invalid login credentials")
    ? "Email o contraseña incorrectos"
    : m.includes("Email not confirmed")
      ? "Tenés que confirmar tu email (revisá tu casilla)"
      : m.includes("already registered")
        ? "Ese email ya está registrado"
        : m.includes("Password should be")
          ? "La contraseña debe tener al menos 6 caracteres"
          : m;

export default function LoginPage() {
  const router = useRouter();
  const { user, perfil, esAdmin, esSuperadmin, cargando } = useApp();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [primeraVez, setPrimeraVez] = useState<boolean | null>(null);
  const alta = !!primeraVez; // las cuentas las crea el superadmin o el admin del comercio
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  // Verifica conexión, clave y que se haya corrido supabase/schema.sql
  useEffect(() => {
    supabase.rpc("sistema_inicializado").then(({ data, error }) => {
      if (!error) return setPrimeraVez(data === false);
      setPrimeraVez(false);
      const m = `${error.message ?? ""} ${(error as { hint?: string }).hint ?? ""}`;
      setDiagnostico(
        /api key|apikey|jwt|401/i.test(m)
          ? "Supabase rechaza la clave (Invalid API key). Revisá NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local: tiene que ser la publishable o la anon public de ESTE proyecto, completa, y reiniciar npm run dev."
          : /sistema_inicializado|function|schema cache|could not find/i.test(m)
            ? "La base no tiene las tablas/funciones: corré supabase/schema.sql en el SQL Editor de Supabase."
            : "No se pudo conectar con Supabase: " + error.message
      );
    });
  }, []);

  useEffect(() => {
    if (!user || cargando) return;
    if (perfil) router.replace(esAdmin ? "/" : "/pos");
    else if (esSuperadmin) router.replace("/clientes");
    else router.replace("/pos"); // sin comercio: la app muestra "usuario sin acceso" con la opción de salir
  }, [user, perfil, esAdmin, esSuperadmin, cargando, router]);

  async function ingresar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) toast.error(traducir(error.message));
    setEnviando(false);
  }

  async function crearAdmin(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("Ingresá tu nombre");
    setEnviando(true);
    // El trigger de la base convierte al PRIMER usuario en administrador general (con su propio comercio)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pass, options: { data: { nombre: nombre.trim() } } });
    setEnviando(false);
    if (error) return toast.error(traducir(error.message));
    if (data.user && data.user.identities?.length === 0) return toast.error("Ese email ya tiene cuenta: ingresá con tu contraseña");
    if (!data.session) {
      toast.success("Te enviamos un email para confirmar la cuenta. Después ingresá.", { duration: 8000 });
      setPrimeraVez(false);
    } else toast.success("¡Listo! Sos el administrador general");
  }

  async function recuperar() {
    if (!email.trim()) return toast.error("Escribí tu email primero");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
    if (error) toast.error(error.message);
    else toast.success("Te enviamos un email para restablecer la contraseña");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-brand-700 p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-xl bg-brand-600 p-3 text-white">
            <Store size={28} />
          </div>
          <h1 className="text-xl font-bold">Mi Kiosko</h1>
          <p className="text-sm text-slate-500">
            {primeraVez ? "Configuración inicial: creá el administrador general"  : "Ingresá a tu cuenta"}
          </p>
        </div>
        {diagnostico && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{diagnostico}</div>}
        <form onSubmit={alta ? crearAdmin : ingresar} className="space-y-3">
          {alta && <input className="input" placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />}
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <input className="input" type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} />
          <button className="btn-primary w-full" disabled={enviando || primeraVez === null}>
            {enviando ? "Procesando..." : primeraVez ? "Crear administrador general"  : "Ingresar"}
          </button>
        </form>
        {!primeraVez && (
          <button onClick={recuperar} className="mt-4 w-full text-center text-xs text-slate-500 hover:text-brand-600">
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {!primeraVez && (
          <p className="mt-1 text-center text-[11px] text-slate-400">Si sos vendedor, pedile una nueva al administrador de tu comercio.</p>
        )}
      </div>
    </div>
  );
}
