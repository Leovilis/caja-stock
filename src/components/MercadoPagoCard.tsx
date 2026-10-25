"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Link2, QrCode, Unlink } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useMpCuenta } from "@/hooks/useMpCuenta";
import { mpConectar, mpDesconectar, type SucursalOpcion } from "@/lib/mp/cliente";
import { errMsg } from "@/lib/supabase";
import { Field } from "./ui";

const PROVINCIAS = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

/** "-34.6037, -58.3816" (como lo copia Google Maps) → [lat, lng] */
function parseCoordenadas(s: string): [number, number] | null {
  const m = s.replace(/[()]/g, "").match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1].replace(",", "."));
  const lng = Number(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

/** Configuración → Mercado Pago: conectar la cuenta para cobrar con QR y que la venta se confirme sola */
export function MercadoPagoCard() {
  const { config } = useApp();
  const { cuenta, cargando } = useMpCuenta();
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [paso, setPaso] = useState<null | { nickname: string; pais: string; sucursales: SucursalOpcion[] }>(null);
  const [elegida, setElegida] = useState<string>("nueva");
  const [suc, setSuc] = useState({ nombre: "", calle: "", numero: "", ciudad: "", provincia: "Buenos Aires", coords: "" });
  const [enviando, setEnviando] = useState(false);

  async function paso1() {
    setEnviando(true);
    try {
      const r = await mpConectar({ token: token.trim(), user_id: userId.trim() || undefined });
      if (r.paso === "sucursal") {
        setPaso(r);
        setElegida(r.sucursales[0]?.id ?? "nueva");
        setSuc((s) => ({ ...s, nombre: s.nombre || config.nombre }));
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setEnviando(false);
    }
  }

  async function paso2() {
    setEnviando(true);
    try {
      if (elegida === "nueva") {
        const c = parseCoordenadas(suc.coords);
        if (!c) throw new Error("Pegá la ubicación como la copia Google Maps, por ejemplo: -34.6037, -58.3816");
        if (!suc.nombre || !suc.calle || !suc.numero || !suc.ciudad) throw new Error("Completá nombre, calle, número y ciudad");
        await mpConectar({
          token: token.trim(),
          user_id: userId.trim() || undefined,
          sucursal: { nombre: suc.nombre, calle: suc.calle, numero: suc.numero, ciudad: suc.ciudad, provincia: suc.provincia, latitud: c[0], longitud: c[1] },
        });
      } else {
        const s = paso?.sucursales.find((x) => x.id === elegida);
        await mpConectar({ token: token.trim(), user_id: userId.trim() || undefined, store_id: elegida, store_nombre: s?.nombre ?? "" });
      }
      toast.success("Mercado Pago conectado: ya podés cobrar con QR desde la caja");
      setPaso(null);
      setToken("");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setEnviando(false);
    }
  }

  async function desconectar() {
    if (!confirm("¿Desconectar Mercado Pago? La caja deja de ofrecer el cobro con QR automático (el QR manual sigue funcionando).")) return;
    try {
      await mpDesconectar();
      toast.success("Desconectado");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <QrCode size={18} /> Mercado Pago — cobro con QR automático
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        La caja genera el cobro por el monto exacto; el cliente escanea y paga, y la venta se confirma sola cuando Mercado Pago la aprueba (con dinero en cuenta,
        débito o crédito, que se registra en el medio que corresponde). No hace falta mirar el celular ni hay riesgo de comprobantes falsos.
      </p>

      {cargando ? (
        <p className="text-sm text-slate-500">Consultando…</p>
      ) : cuenta ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
            Conectado a <b>{cuenta.nickname || "tu cuenta"}</b>
            {cuenta.store_nombre && <> · sucursal «{cuenta.store_nombre}»</>} · caja <span className="font-mono text-xs">{cuenta.external_pos_id}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cuenta.qr_pdf && (
              <a className="btn-ghost btn-sm" href={cuenta.qr_pdf} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Cartel con el QR para imprimir
              </a>
            )}
            {cuenta.qr_imagen && (
              <a className="btn-ghost btn-sm" href={cuenta.qr_imagen} target="_blank" rel="noreferrer">
                <QrCode size={14} /> Ver QR de la caja
              </a>
            )}
            <button className="btn-ghost btn-sm text-rose-700" onClick={desconectar}>
              <Unlink size={14} /> Desconectar
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Para que los pagos se registren en «QR Mercado Pago · Dinero en cuenta / Débito / Crédito» con su comisión, agregá esa plantilla en <b>Medios de cobro</b>.
          </p>
        </div>
      ) : !paso ? (
        <div className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>
              Entrá a{" "}
              <a className="text-brand-600 underline" href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer">
                Mercado Pago Developers → Tus integraciones
              </a>{" "}
              con la cuenta que cobra en el local y creá una aplicación (pagos presenciales / código QR).
            </li>
            <li>
              En la aplicación, abrí <b>Credenciales de producción</b> y copiá el <b>Access Token</b> (empieza con <code>APP_USR-</code>).
            </li>
            <li>Pegalo acá. Se guarda cifrado y sólo lo usa el servidor.</li>
          </ol>
          <Field label="Access Token de producción">
            <input className="input font-mono" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-…" />
          </Field>
          <Field label="User ID (sólo si te lo pide)">
            <input className="input max-w-xs font-mono" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="ej: 123456789" />
            <span className="mt-1 block text-xs text-slate-500">
              Número de tu cuenta de Mercado Pago. Lo ves en Tus integraciones → tu aplicación (datos de la aplicación / credenciales).
            </span>
          </Field>
          <button className="btn-primary" disabled={enviando || token.trim().length < 20} onClick={paso1}>
            <Link2 size={16} /> {enviando ? "Verificando…" : "Conectar"}
          </button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            Cuenta: <b>{paso.nickname}</b>
            {paso.pais && paso.pais !== "MLA" && <span className="ml-2 text-rose-700">(no es una cuenta de Argentina: {paso.pais})</span>}
          </div>
          <div className="font-medium">¿En qué sucursal de Mercado Pago creamos la caja?</div>
          {paso.sucursales.map((s) => (
            <label key={s.id} className="flex items-start gap-2">
              <input type="radio" checked={elegida === s.id} onChange={() => setElegida(s.id)} className="mt-1" />
              <span>
                {s.nombre} {s.direccion && <span className="text-xs text-slate-500">· {s.direccion}</span>}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="radio" checked={elegida === "nueva"} onChange={() => setElegida("nueva")} /> Crear una sucursal nueva
          </label>
          {elegida === "nueva" && (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
              <Field label="Nombre">
                <input className="input" value={suc.nombre} onChange={(e) => setSuc({ ...suc, nombre: e.target.value })} />
              </Field>
              <Field label="Provincia">
                <select className="input" value={suc.provincia} onChange={(e) => setSuc({ ...suc, provincia: e.target.value })}>
                  {PROVINCIAS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Calle">
                <input className="input" value={suc.calle} onChange={(e) => setSuc({ ...suc, calle: e.target.value })} />
              </Field>
              <Field label="Número">
                <input className="input" value={suc.numero} onChange={(e) => setSuc({ ...suc, numero: e.target.value })} />
              </Field>
              <Field label="Ciudad / localidad">
                <input className="input" value={suc.ciudad} onChange={(e) => setSuc({ ...suc, ciudad: e.target.value })} />
              </Field>
              <Field label="Ubicación (de Google Maps)">
                <input className="input" value={suc.coords} onChange={(e) => setSuc({ ...suc, coords: e.target.value })} placeholder="-34.6037, -58.3816" />
              </Field>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Ubicación: en Google Maps hacé clic derecho sobre tu local y tocá los números que aparecen arriba (se copian). Mercado Pago la pide para la sucursal.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={enviando} onClick={paso2}>
              {enviando ? "Conectando…" : "Crear la caja y conectar"}
            </button>
            <button className="btn-ghost" onClick={() => setPaso(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
