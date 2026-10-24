"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { ArrowDownCircle, ArrowUpCircle, Lock, Printer, Wallet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { abrirCaja, calcularResumen, cerrarCaja, movimientoCaja, registrarGasto } from "@/lib/db";
import { money, fechaHora, hora, round2, isoDate } from "@/lib/format";
import { imprimirCierreCaja } from "@/lib/ticket";
import type { Caja, MovimientoCaja, Venta } from "@/lib/types";
import { medioLabel } from "@/lib/types";
import { Badge, Empty, Field, Modal, NumInput, PageHeader, Stat } from "@/components/ui";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export default function CajaPage() {
  const { caja, esAdmin, config } = useApp();
  const cajaId = caja?.id ?? "";
  const { data: ventas } = useQuery<Venta>(() => supabase.from("ventas").select("*").eq("caja_id", cajaId), ["ventas"], cajaId, !!caja);
  const { data: movs } = useQuery<MovimientoCaja>(() => supabase.from("movimientos_caja").select("*").eq("caja_id", cajaId), ["movimientos_caja"], cajaId, !!caja);
  const { data: historial } = useQuery<Caja>(
    () => supabase.from("cajas").select("*").eq("estado", "cerrada").order("apertura", { ascending: false }),
    ["cajas"],
    "hist",
    esAdmin
  );

  const [modalMov, setModalMov] = useState<null | "ingreso" | "egreso">(null);
  const [modalCierre, setModalCierre] = useState(false);
  const [montoApertura, setMontoApertura] = useState(0);

  const resumen = useMemo(() => (caja ? calcularResumen(caja, ventas, movs) : null), [caja, ventas, movs]);
  const movsOrdenados = useMemo(() => [...movs].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()), [movs]);

  return (
    <div>
      <PageHeader title="Caja" subtitle="Apertura, movimientos de efectivo y cierre con arqueo">
        {caja && (
          <>
            <button className="btn-ghost" onClick={() => setModalMov("ingreso")}>
              <ArrowDownCircle size={16} className="text-emerald-600" /> Ingreso
            </button>
            <button className="btn-ghost" onClick={() => setModalMov("egreso")}>
              <ArrowUpCircle size={16} className="text-rose-600" /> Retiro / Pago
            </button>
            <button className="btn-danger" onClick={() => setModalCierre(true)}>
              <Lock size={16} /> Cerrar caja
            </button>
          </>
        )}
      </PageHeader>

      {!caja ? (
        <div className="card mx-auto max-w-sm p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wallet size={18} /> Abrir caja
          </h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await abrirCaja(montoApertura);
                toast.success("Caja abierta");
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Field label="Efectivo inicial">
              <NumInput value={montoApertura} onChange={setMontoApertura} placeholder="0" autoFocus />
            </Field>
            <button className="btn-primary w-full">Abrir caja</button>
          </form>
        </div>
      ) : (
        resumen && (
          <>
            <div className="mb-2 text-sm text-slate-500">
              Abierta {fechaHora(caja.apertura)} por <b>{caja.abierta_por_nombre}</b> · Fondo inicial {money(caja.monto_inicial)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Ventas del turno" value={money(resumen.totalVentas)} hint={`${resumen.cantVentas} tickets${resumen.cantAnuladas ? ` · ${resumen.cantAnuladas} anuladas` : ""}`} tone="blue" />
              <Stat label="Efectivo en caja (esperado)" value={money(resumen.efectivoEsperado)} tone="green" />
              <Stat label="Ingresos / Egresos" value={`${money(resumen.ingresos)} / ${money(resumen.egresos)}`} />
              {esAdmin ? (
                <Stat label="Ganancia bruta" value={money(resumen.ganancia)} hint="Ventas − costo de mercadería" />
              ) : (
                <Stat label="Ticket promedio" value={money(resumen.cantVentas ? resumen.totalVentas / resumen.cantVentas : 0)} />
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="mb-3 font-semibold">Por medio de pago</h3>
                <table className="table">
                  <tbody>
                    {Object.entries(resumen.porMedio).length === 0 && (
                      <tr>
                        <td className="text-slate-400">Sin ventas todavía</td>
                      </tr>
                    )}
                    {Object.entries(resumen.porMedio).map(([m, v]) => (
                      <tr key={m}>
                        <td>{medioLabel(m)}</td>
                        <td className="text-right font-medium tabular-nums">{money(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card p-4">
                <h3 className="mb-3 font-semibold">Movimientos de efectivo</h3>
                {movsOrdenados.length === 0 ? (
                  <Empty>Sin movimientos</Empty>
                ) : (
                  <table className="table">
                    <tbody>
                      {movsOrdenados.map((m) => (
                        <tr key={m.id}>
                          <td className="w-14 text-xs text-slate-500">{hora(m.fecha)}</td>
                          <td>
                            {m.concepto}
                            <div className="text-xs text-slate-400">{m.usuario_nombre}</div>
                          </td>
                          <td className={`text-right font-medium tabular-nums ${m.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"}`}>
                            {m.tipo === "ingreso" ? "+" : "−"}
                            {money(m.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )
      )}

      {esAdmin && (
        <div className="card mt-8 overflow-x-auto">
          <h3 className="p-4 font-semibold">Historial de cierres</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Responsable</th>
                <th className="text-right">Ventas</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Contado</th>
                <th className="text-right">Diferencia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historial.map((c) => (
                  <tr key={c.id}>
                    <td>{fechaHora(c.apertura)}</td>
                    <td>{fechaHora(c.cierre)}</td>
                    <td>
                      {c.abierta_por_nombre}
                      {c.cerrada_por_nombre && c.cerrada_por_nombre !== c.abierta_por_nombre ? ` → ${c.cerrada_por_nombre}` : ""}
                    </td>
                    <td className="text-right tabular-nums">{money(c.total_ventas)}</td>
                    <td className="text-right tabular-nums">{money(c.efectivo_esperado)}</td>
                    <td className="text-right tabular-nums">{money(c.efectivo_contado)}</td>
                    <td className="text-right">
                      <Badge tone={Math.abs(c.diferencia ?? 0) < 1 ? "green" : (c.diferencia ?? 0) < 0 ? "red" : "amber"}>
                        {money(c.diferencia)}
                      </Badge>
                    </td>
                    <td>
                      <button className="text-slate-400 hover:text-brand-600" onClick={() => imprimirCierreCaja(c, config)} title="Imprimir">
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MovimientoModal tipo={modalMov} onClose={() => setModalMov(null)} />
      {caja && resumen && (
        <CierreModal open={modalCierre} onClose={() => setModalCierre(false)} caja={caja} esperado={resumen.efectivoEsperado} />
      )}
    </div>
  );
}

function MovimientoModal({ tipo, onClose }: { tipo: null | "ingreso" | "egreso"; onClose: () => void }) {
  const { caja, config, modulo } = useApp();
  const [monto, setMonto] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [esGasto, setEsGasto] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (!caja || !tipo || monto <= 0) return;
    setEnviando(true);
    try {
      if (tipo === "egreso" && esGasto) {
        await registrarGasto({
          fecha: isoDate(new Date()),
          categoria: categoria || config.categorias_gasto[0] || "Otros",
          descripcion: concepto,
          monto,
          medio: "efectivo",
          desdeCaja: true,
        });
      } else {
        await movimientoCaja(tipo, monto, concepto);
      }
      toast.success("Movimiento registrado");
      setMonto(0);
      setConcepto("");
      setEsGasto(false);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={!!tipo} onClose={onClose} title={tipo === "ingreso" ? "Ingreso de efectivo" : "Retiro / pago desde caja"} size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label="Monto">
          <NumInput value={monto} onChange={setMonto} autoFocus placeholder="0" />
        </Field>
        <Field label="Concepto">
          <input
            className="input"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={tipo === "ingreso" ? "Ej: cambio extra" : "Ej: retiro del dueño, pago repartidor"}
          />
        </Field>
        {tipo === "egreso" && modulo("gastos") && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={esGasto} onChange={(e) => setEsGasto(e.target.checked)} />
              Registrar también como gasto del negocio
            </label>
            {esGasto && (
              <Field label="Categoría de gasto">
                <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {config.categorias_gasto.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        <button className="btn-primary w-full" disabled={enviando || monto <= 0}>
          Guardar
        </button>
      </form>
    </Modal>
  );
}

function CierreModal({ open, onClose, caja, esperado }: { open: boolean; onClose: () => void; caja: Caja; esperado: number }) {
  const { config } = useApp();
  const [conteo, setConteo] = useState<Record<number, number>>({});
  const [otros, setOtros] = useState(0);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const contado = round2(DENOMINACIONES.reduce((a, d) => a + d * (conteo[d] ?? 0), 0) + otros);
  const dif = round2(contado - esperado);

  async function cerrar() {
    if (!confirm(`¿Cerrar la caja con ${money(contado)} contados (diferencia ${money(dif)})?`)) return;
    setEnviando(true);
    try {
      const cerrada = await cerrarCaja(caja.id, contado, obs);
      toast.success("Caja cerrada");
      imprimirCierreCaja(cerrada, config);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cierre de caja — arqueo" size="lg">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="label">Conteo de billetes</div>
          <div className="space-y-1.5">
            {DENOMINACIONES.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-24 text-right text-sm tabular-nums">{money(d).replace(",00", "")}</span>
                <span className="text-slate-400">×</span>
                <NumInput
                  className="input w-20 py-1"
                  value={conteo[d] ?? 0}
                  placeholder="0"
                  onChange={(n) => setConteo((c) => ({ ...c, [d]: n }))}
                />
                <span className="ml-auto text-sm tabular-nums text-slate-500">{money(d * (conteo[d] ?? 0))}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-24 text-right text-sm">Monedas/otros</span>
              <span className="text-slate-400">$</span>
              <NumInput className="input w-28 py-1" value={otros} placeholder="0" onChange={setOtros} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex justify-between text-sm">
              <span>Efectivo esperado</span>
              <b className="tabular-nums">{money(esperado)}</b>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span>Efectivo contado</span>
              <b className="tabular-nums">{money(contado)}</b>
            </div>
            <div className={`mt-3 flex justify-between text-lg font-bold ${Math.abs(dif) < 1 ? "text-emerald-600" : dif < 0 ? "text-rose-600" : "text-amber-600"}`}>
              <span>{Math.abs(dif) < 1 ? "Caja OK" : dif < 0 ? "Faltante" : "Sobrante"}</span>
              <span className="tabular-nums">{money(dif)}</span>
            </div>
          </div>
          <Field label="Observaciones">
            <textarea className="input" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
          <button className="btn-danger w-full" disabled={enviando} onClick={cerrar}>
            <Lock size={16} /> Confirmar cierre
          </button>
          <p className="text-xs text-slate-500">Se imprimirá el resumen de cierre. Las ventas con tarjeta/QR se controlan contra el resumen del posnet.</p>
        </div>
      </div>
    </Modal>
  );
}
