"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileCheck2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { facturar } from "@/lib/arca/cliente";
import { calcularImportes, CONDICIONES_RECEPTOR, cuitValido, letraPara, nombreCbte, TIPOS_DOC, validarReceptor } from "@/lib/arca/calculo";
import { imprimirComprobante } from "@/lib/ticket";
import { money } from "@/lib/format";
import type { Comprobante, Venta } from "@/lib/types";
import { facturacionConfigurada } from "@/lib/types";
import { Field, Modal } from "./ui";

/** Emite la factura electrónica de una venta (a pedido del cliente) */
export function FacturarModal({ venta, onClose, onListo }: { venta: Venta | null; onClose: () => void; onListo?: (c: Comprobante) => void }) {
  const { config, esAdmin } = useApp();
  const [docTipo, setDocTipo] = useState(99);
  const [docNro, setDocNro] = useState("");
  const [condicion, setCondicion] = useState(5);
  const [nombre, setNombre] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (venta) {
      setDocTipo(99);
      setDocNro("");
      setCondicion(5);
      setNombre("");
      setDomicilio("");
    }
  }, [venta]);

  const letra = letraPara(config.fiscal_condicion, condicion);
  // Si eligen Responsable Inscripto (factura A) el documento tiene que ser CUIT
  useEffect(() => {
    if (letra === "A" && docTipo !== 80) setDocTipo(80);
  }, [letra, docTipo]);

  const imp = useMemo(
    () => (venta ? calcularImportes(letra, venta.venta_items.map((i) => ({ subtotal: Number(i.subtotal), alicuota_iva: Number(i.alicuota_iva ?? 21) })), Number(venta.total)) : null),
    [venta, letra]
  );
  const nro = Number(docNro.replace(/\D/g, "")) || 0;
  const error = venta ? validarReceptor(letra, docTipo, docTipo === 99 ? 0 : nro, condicion) : null;
  const cuitMal = (docTipo === 80 || docTipo === 86) && docNro.replace(/\D/g, "").length === 11 && !cuitValido(docNro);

  if (!venta) return null;
  const listo = facturacionConfigurada(config);

  async function emitir() {
    if (!venta || error) return;
    setEnviando(true);
    const t = toast.loading("Pidiendo CAE a ARCA…");
    try {
      const c = await facturar(venta.id, { docTipo, docNro: docTipo === 99 ? 0 : nro, condicion, nombre, domicilio });
      toast.success(`${nombreCbte("factura", c.letra)} N° ${c.numero} autorizada · CAE ${c.cae}`, { id: t, duration: 6000 });
      await imprimirComprobante(venta, c, config);
      onListo?.(c);
      onClose();
    } catch (e) {
      toast.error((e as Error).message, { id: t, duration: 10000 });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={!!venta} onClose={onClose} title={`Facturar venta #${venta.numero}`} size="md">
      {!listo ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          La facturación electrónica no está configurada. {esAdmin ? "Completá los datos en Configuración → Facturación electrónica." : "Pedile al administrador que la configure."}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-900 p-3 text-white">
            <div>
              <div className="text-xs uppercase text-slate-400">Se emitirá</div>
              <div className="text-xl font-bold">{nombreCbte("factura", letra)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-slate-400">Total</div>
              <div className="text-xl font-bold tabular-nums">{money(venta.total)}</div>
            </div>
          </div>
          {config.fiscal_ambiente === "homologacion" && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Ambiente de PRUEBA (homologación): el comprobante no tiene validez fiscal.</div>
          )}

          <Field label="Condición frente al IVA del cliente">
            <select className="input" value={condicion} onChange={(e) => setCondicion(Number(e.target.value))}>
              {CONDICIONES_RECEPTOR.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-[150px_1fr] gap-2">
            <Field label="Documento">
              <select className="input" value={docTipo} onChange={(e) => setDocTipo(Number(e.target.value))} disabled={letra === "A"}>
                {TIPOS_DOC.filter((t) => condicion === 5 || t.id !== 99).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id === 99 ? "Sin identificar" : t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Número">
              <input
                className="input"
                inputMode="numeric"
                disabled={docTipo === 99}
                value={docTipo === 99 ? "" : docNro}
                onChange={(e) => setDocNro(e.target.value)}
                placeholder={docTipo === 80 ? "20-12345678-9" : docTipo === 99 ? "—" : ""}
              />
            </Field>
          </div>
          {docTipo !== 99 && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nombre / Razón social">
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
              <Field label="Domicilio">
                <input className="input" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
              </Field>
            </div>
          )}

          {imp && letra !== "C" && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Neto gravado</span>
                <span className="tabular-nums">{money(imp.imp_neto)}</span>
              </div>
              {imp.iva.map((a) => (
                <div key={a.alicuota} className="flex justify-between text-slate-500">
                  <span>IVA {String(a.alicuota).replace(".", ",")}%</span>
                  <span className="tabular-nums">{money(a.importe)}</span>
                </div>
              ))}
            </div>
          )}

          {(error && (docTipo === 99 || docNro) ? error : cuitMal ? "El CUIT no es válido" : null) && (
            <div className="text-sm text-rose-600">{cuitMal ? "El CUIT no es válido" : error}</div>
          )}

          <button className="btn-primary w-full py-3" disabled={!!error || enviando} onClick={emitir}>
            <FileCheck2 size={18} /> {enviando ? "Autorizando…" : "Emitir factura"}
          </button>
          <p className="text-xs text-slate-500">
            Si ARCA pide identificar al consumidor final (por el monto), elegí DNI y cargá el número.
          </p>
        </div>
      )}
    </Modal>
  );
}
