"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, errorConfig } from "@/lib/supabase";
import type { Caja, Config, Perfil } from "@/lib/types";
import { CONFIG_DEFAULT } from "@/lib/types";

interface AppState {
  user: User | null;
  perfil: Perfil | null;
  cargando: boolean;
  esAdmin: boolean;
  config: Config;
  caja: Caja | null; // turno de caja abierto (en tiempo real)
  recuperandoClave: boolean; // el usuario entró desde el link "olvidé mi contraseña"
  finRecuperacion: () => void;
  salir: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [config, setConfig] = useState<Config>(CONFIG_DEFAULT);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [recuperandoClave, setRecuperando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setCargandoAuth(false);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setUser(session?.user ?? null);
      if (!session) setPerfil(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const cargarPerfil = useCallback(async (uid: string) => {
    const { data } = await supabase.from("perfiles").select("*").eq("id", uid).maybeSingle();
    setPerfil((data as Perfil) ?? null);
    setCargandoPerfil(false);
  }, []);

  // Perfil (rol) + escucha cambios (ej: el admin te desactiva)
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    setCargandoPerfil(true);
    cargarPerfil(uid);
    const ch = supabase
      .channel("perfil-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "perfiles", filter: `id=eq.${uid}` }, () => cargarPerfil(uid))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, cargarPerfil]);

  // Configuración y caja abierta, en vivo
  const activo = !!perfil?.activo;
  useEffect(() => {
    if (!activo) return;
    const cargarConfig = async () => {
      const { data } = await supabase.from("config").select("*").eq("id", 1).maybeSingle();
      if (data) setConfig({ ...CONFIG_DEFAULT, ...(data as Partial<Config>) });
    };
    const cargarCaja = async () => {
      const { data } = await supabase.from("cajas").select("*").eq("estado", "abierta").maybeSingle();
      setCaja((data as Caja) ?? null);
    };
    cargarConfig();
    cargarCaja();
    const ch = supabase
      .channel("global")
      .on("postgres_changes", { event: "*", schema: "public", table: "config" }, cargarConfig)
      .on("postgres_changes", { event: "*", schema: "public", table: "cajas" }, cargarCaja)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activo]);

  const value: AppState = {
    user,
    perfil,
    cargando: cargandoAuth || cargandoPerfil,
    esAdmin: perfil?.rol === "admin" && perfil.activo,
    config,
    caja,
    recuperandoClave,
    finRecuperacion: () => setRecuperando(false),
    salir: async () => {
      await supabase.auth.signOut();
    },
  };
  if (errorConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md p-6">
          <h2 className="text-lg font-semibold text-rose-600">Falta configurar Supabase</h2>
          <p className="mt-2 text-sm">{errorConfig}</p>
          <p className="mt-3 text-xs text-slate-500">
            Editá el archivo <code>.env.local</code> en la raíz del proyecto y reiniciá <code>npm run dev</code> (Next sólo lee ese archivo al arrancar).
          </p>
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
}
