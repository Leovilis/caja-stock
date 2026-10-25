"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { mpCancelarCobro, mpCrearCobro, mpEstadoCobro } from "@/lib/mp/cliente";
import { money } from "@/lib/format";
import { medioParaPagoMP, TIPO_PAGO_MP, type MedioConfig, type Pago } from "@/lib/types";

const CADA_MS = 2500;
const VENCE_MS = 10 * 60_000;

/**
 * Cobro con QR de Mercado Pago: crea la orden, muestra el QR y consulta hasta que se aprueba.
 * Al aprobarse llama a onAprobado con el pago listo para registrar la venta.
 */
export function QrMercadoPago({
  monto,
  medios,
  onAprobado,
  onSalir,
}: {
  monto: number;
  medios: MedioConfig[];
  onAprobado: (pago: Pago, tipo: string | null) => void;
  onSalir: () => void;
}) {
  const [fase, setFase] = useState<"creando" | "esperando" | "aprobado" | "terminado" | "error">("creando");
  const [mensaje, setMensaje] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [qrCaja, setQrCaja] = useState<string | null>(null);
  const [restan, setRestan] = useState(VENCE_MS);
  const cobro = useRef<{ id: string; order_id: string } | null>(null);
  const avisado = useRef(false);

  useEffect(() => {
    // variables locales a ESTE efecto (en desarrollo React lo monta dos veces)
    let vivo = true;
    let mio: { id: string; order_id: string } | null = null;
    const inicio = Date.now();
    let t: ReturnType<typeof setTimeout> | undefined;

    const consultar = async () => {
      if (!vivo || !mio) return;
      try {
        const r = await mpEstadoCobro(mio.id);
        if (!vivo) return;
        if (r.estado === "aprobado") {
          setFase("aprobado");
          setMensaje(r.tipo_pago ? `Pagó con ${TIPO_PAGO_MP[r.tipo_pago] ?? r.tipo_pago}` : "");
          if (!avisado.current) {
            avisado.current = true;
            const medio = medioParaPagoMP(r.tipo_pago, medios) ?? "qr";
            onAprobado({ medio, monto, mp_order: r.order_id, sin_recargo: true }, r.tipo_pago);
          }
          return;
        }
        if (r.estado !== "pendiente") {
          setFase("terminado");
          setMensaje(r.estado === "vencido" ? "El cobro venció sin pagarse." : r.estado === "rechazado" ? "El pago fue rechazado." : "El cobro se canceló.");
          return;
        }
      } catch {
        /* error de red: se reintenta */
      }
      setRestan(Math.max(0, VENCE_MS - (Date.now() - inicio)));
      t = setTimeout(consultar, CADA_MS);
    };

    mpCrearCobro(monto)
      .then(async (c) => {
        if (!vivo) {
          mpCancelarCobro(c.id).catch(() => {});
          return;
        }
        mio = { id: c.id, order_id: c.order_id };
        cobro.current = mio;
        setQrCaja(c.qr_imagen);
        if (c.qr_data) setQr(await QRCode.toDataURL(c.qr_data, { margin: 1, width: 240 }));
        if (!vivo) return;
        setFase("esperando");
        t = setTimeout(consultar, CADA_MS);
      })
      .catch((e) => {
        if (!vivo) return;
        setFase("error");
        setMensaje((e as Error).message);
      });

    return () => {
      vivo = false;
      clearTimeout(t);
      // si se cierra la ventana sin pagar, se cancela la orden para que no quede cobrable
      if (mio && !avisado.current) mpCancelarCobro(mio.id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancelar() {
    if (cobro.current && fase === "esperando") {
      try {
        const r = await mpCancelarCobro(cobro.current.id);
        if (r.estado === "aprobado") return; // justo pagó: lo toma la consulta
      } catch (e) {
        setMensaje((e as Error).message);
        return;
      }
    }
    cobro.current = null;
    onSalir();
  }

  const min = Math.floor(restan / 60000);
  const seg = Math.floor((restan % 60000) / 1000);

  return (
    <div className="text-center">
      <div className="mb-3 rounded-xl bg-sky-600 p-3 text-white">
        <div className="text-xs uppercase tracking-wider text-sky-100">Cobro con QR Mercado Pago</div>
        <div className="text-3xl font-bold tabular-nums">{money(monto)}</div>
      </div>

      {fase === "creando" && (
        <p className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <Loader2 className="animate-spin" size={18} /> Generando el cobro…
        </p>
      )}

      {fase === "esperando" && (
        <>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR de pago" className="mx-auto h-56 w-56" />
          ) : (
            qrCaja && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCaja} alt="QR de la caja" className="mx-auto h-56 w-56" />
            )
          )}
          <p className="mt-2 text-sm text-slate-600">
            {qr ? "El cliente escanea este QR o el QR impreso de la caja" : "El cliente escanea el QR de la caja"} con Mercado Pago o su billetera.
          </p>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-sky-700">
            <Loader2 className="animate-spin" size={16} /> Esperando el pago… ({min}:{String(seg).padStart(2, "0")})
          </p>
          {mensaje && <p className="mt-2 text-sm text-rose-600">{mensaje}</p>}
          <button className="btn-ghost mt-4 w-full" onClick={cancelar}>
            Cancelar cobro
          </button>
        </>
      )}

      {fase === "aprobado" && (
        <div className="py-6 text-emerald-700">
          <CheckCircle2 size={56} className="mx-auto" />
          <div className="mt-2 text-xl font-bold">Pago aprobado</div>
          <div className="text-sm">{mensaje} · registrando la venta…</div>
        </div>
      )}

      {(fase === "terminado" || fase === "error") && (
        <div className="py-6">
          <XCircle size={48} className="mx-auto text-rose-500" />
          <p className="mt-2 text-sm text-slate-700">{mensaje}</p>
          <button className="btn-ghost mt-4 w-full" onClick={onSalir}>
            Volver a los medios de pago
          </button>
        </div>
      )}
    </div>
  );
}
