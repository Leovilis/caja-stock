"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, Download, Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase, errMsg } from "@/lib/supabase";
import { anularPagoProveedor, registrarPagoProveedor } from "@/lib/db";
import { descargarCSV } from "@/lib/csv";
import { fecha, fechaHora, inicioMes, money, round2 } from "@/lib/format";
import { pendienteCompra, saldosProveedores, type Compra, type PagoProveedor, type Proveedor } from "@/lib/types";
import { Badge, Empty, Field, Modal, NumInput, PageHeader, Stat } from "@/components/ui";

const MEDIOS = [
  { id: "efectivo", label: "Efectivo", hint: "Sale de la caja abierta" },
  { id: "transferencia", label: "Transferencia", hint: "No toca la caja" },
  { id: "otro", label: "Otro", hint: "Cheque, Mercado Pago, etc." },
] as const;
type MedioPagoProv = (typeof MEDIOS)[number]["id"];
const medioNombre = (m: string) => MEDIOS.find((x) => x.id === m)?.label ?? m;
const dmy = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export default function PagosProveedoresPage() {
  // useSearchParams necesita un Suspense alrededor
  return (
    <Suspense>
      <PagosProveedores />
    </Suspense>
  );
}

function PagosProveedores() {
  const params = useSearchParams();
  const { data: proveedores } = useQuery<Proveedor>(() => supabase.from("proveedores").select("*"), ["proveedores"]);
  const { data: comprasCC } = useQuery<Compra>(() => supabase.from("compras").select("*").eq("medio", "cuenta_corriente"), ["compras"]);
  const { data: pagos } = useQuery<PagoProveedor>(() => supabase.from("pagos_proveedor").select("*").order("fecha", { ascending: false }), ["pagos_proveedor"]);
  const [nuevo, setNuevo] = useState<string | null>(null); // proveedor inicial ("" = elegir)
  const [fProv, setFProv] = useState("");
  const [fMedio, setFMedio] = useState("");

  useEffect(() => {
    const p = params.get("proveedor");
    if (p) setNuevo(p);
  }, [params]);

  const saldos = useMemo(() => saldosProveedores(comprasCC, pagos, proveedores), [comprasCC, pagos, proveedores]);
  const conDeuda = saldos.filter((s) => s.saldo !== 0 || s.facturas > 0);
  const deudaTotal = round2(saldos.reduce((a, s) => a + Math.max(0, s.saldo), 0));
  const vencido = round2(saldos.reduce((a, s) => a + s.vencido, 0));
  const ini = inicioMes().getTime();
  const pagadoMes = round2(pagos.filter((p) => !p.anulado && new Date(p.fecha).getTime() >= ini).reduce((a, p) => a + Number(p.total), 0));
  const lista = pagos.filter((p) => (!fProv || p.proveedor_id === fProv) && (!fMedio || p.medio === fMedio));

  async function anular(p: PagoProveedor) {
    const motivo = prompt(
      `Anular el pago de ${money(p.total)} a ${p.proveedor_nombre}.\nLas facturas vuelven a deber lo que se les aplicó.${p.medio === "efectivo" ? "\nSi la caja de ese día sigue abierta, se quita el egreso." : ""}\n\nMotivo:`
    );
    if (!motivo?.trim()) return;
    try {
      await anularPagoProveedor(p.id, motivo.trim());
      toast.success("Pago anulado");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div>
      <PageHeader title="Pagos a proveedores" subtitle="Cuenta corriente: cuánto le debés a cada proveedor y qué le pagaste">
        <button
          className="btn-ghost"
          disabled={!lista.length}
          onClick={() =>
            descargarCSV(
              "pagos-proveedores",
              lista.map((p) => ({
                fecha: fechaHora(p.fecha),
                proveedor: p.proveedor_nombre,
                metodo: medioNombre(p.medio),
                facturas: p.aplicaciones.map((a) => a.comprobante || fecha(a.fecha)).join(" + ") + (Number(p.a_cuenta) > 0 ? " + a cuenta" : ""),
                total: String(p.total).replace(".", ","),
                estado: p.anulado ? "ANULADO" : "",
                notas: p.notas,
              }))
            )
          }
        >
          <Download size={16} /> CSV
        </button>
        <button className="btn-primary" onClick={() => setNuevo("")}>
          <Plus size={16} /> Nuevo pago
        </button>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Le debés a proveedores" value={money(deudaTotal)} tone="amber" hint={`${conDeuda.filter((s) => s.saldo > 0).length} proveedores`} />
        <Stat label="Facturas vencidas" value={money(vencido)} tone={vencido > 0 ? "red" : "default"} hint="Con fecha de vencimiento pasada" />
        <Stat label="Pagado este mes" value={money(pagadoMes)} tone="green" />
      </div>

      <div className="card mb-6 overflow-x-auto">
        <div className="p-4">
          <h3 className="font-semibold">Saldos por proveedor</h3>
          <p className="text-xs text-slate-500">Las compras cargadas con pago «Cuenta corriente» quedan acá hasta que las pagues.</p>
        </div>
        {conDeuda.length === 0 ? (
          <Empty>No le debés nada a ningún proveedor 👌</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th className="text-right">Facturas</th>
                <th className="text-right">Deuda</th>
                <th className="text-right">A cuenta</th>
                <th className="text-right">Saldo</th>
                <th>Próximo vto.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conDeuda.map((s) => (
                <tr key={s.proveedor_id}>
                  <td className="font-medium">
                    {s.nombre}
                    {s.vencido > 0 && (
                      <div>
                        <Badge tone="red">Vencido {money(s.vencido)}</Badge>
                      </div>
                    )}
                  </td>
                  <td className="text-right">{s.facturas}</td>
                  <td className="text-right tabular-nums">{money(s.deuda)}</td>
                  <td className="text-right tabular-nums text-emerald-700">{s.aCuenta ? `−${money(s.aCuenta)}` : "—"}</td>
                  <td className={`text-right font-semibold tabular-nums ${s.saldo > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {s.saldo < 0 ? `${money(-s.saldo)} a favor` : money(s.saldo)}
                  </td>
                  <td className="text-sm">{dmy(s.proximoVto)}</td>
                  <td className="text-right">
                    <button className="btn-primary btn-sm" onClick={() => setNuevo(s.proveedor_id)}>
                      Pagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <h3 className="mr-auto font-semibold">
            Pagos registrados <span className="text-sm font-normal text-slate-500">({lista.length})</span>
          </h3>
          <select className="input w-auto" value={fProv} onChange={(e) => setFProv(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {[...proveedores]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
          <select className="input w-auto" value={fMedio} onChange={(e) => setFMedio(e.target.value)}>
            <option value="">Todos los métodos</option>
            {MEDIOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {lista.length === 0 ? (
          <Empty>Todavía no registraste pagos</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Método</th>
                <th>Facturas</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className={p.anulado ? "opacity-50" : ""}>
                  <td className="whitespace-nowrap text-xs">{fechaHora(p.fecha)}</td>
                  <td className="font-medium">
                    {p.proveedor_nombre}
                    {p.notas && <div className="text-xs font-normal text-slate-500">{p.notas}</div>}
                  </td>
                  <td>
                    <Badge>{medioNombre(p.medio)}</Badge>
                  </td>
                  <td className="text-xs text-slate-600">
                    {p.aplicaciones.map((a) => a.comprobante || `del ${fecha(a.fecha)}`).join(", ")}
                    {Number(p.a_cuenta) > 0 && <span className="text-slate-400">{p.aplicaciones.length ? " + " : ""}a cuenta {money(p.a_cuenta)}</span>}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {money(p.total)}
                    {p.anulado && (
                      <div className="text-xs font-normal text-rose-600" title={p.motivo_anulacion ?? ""}>
                        Anulado por {p.anulado_por}
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    {!p.anulado && (
                      <button className="p-1 text-slate-400 hover:text-rose-600" title="Anular pago" onClick={() => anular(p)}>
                        <Ban size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NuevoPagoModal
        abierto={nuevo !== null}
        proveedorInicial={nuevo ?? ""}
        onClose={() => setNuevo(null)}
        proveedores={proveedores}
        compras={comprasCC}
        pagos={pagos}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NuevoPagoModal({
  abierto,
  proveedorInicial,
  onClose,
  proveedores,
  compras,
  pagos,
}: {
  abierto: boolean;
  proveedorInicial: string;
  onClose: () => void;
  proveedores: Proveedor[];
  compras: Compra[];
  pagos: PagoProveedor[];
}) {
  const { caja } = useApp();
  const [prov, setProv] = useState("");
  const [montos, setMontos] = useState<Record<string, number>>({});
  const [aCuenta, setACuenta] = useState(0);
  const [medio, setMedio] = useState<MedioPagoProv>("transferencia");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setProv(proveedorInicial);
    setMontos({});
    setACuenta(0);
    setMedio("transferencia");
    setNotas("");
  }, [abierto, proveedorInicial]);

  const saldo = useMemo(() => saldosProveedores(compras, pagos, proveedores).find((s) => s.proveedor_id === prov), [compras, pagos, proveedores, prov]);
  const facturas = useMemo(
    () =>
      compras
        .filter((c) => c.proveedor_id === prov && pendienteCompra(c) > 0)
        .sort((a, b) => (a.vence ?? a.fecha).localeCompare(b.vence ?? b.fecha)),
    [compras, prov]
  );
  const hoy = hoyISO();
  const total = round2(Object.values(montos).reduce((a, b) => a + (b || 0), 0) + (aCuenta || 0));

  const marcarTodas = () => setMontos(Object.fromEntries(facturas.map((c) => [c.id, pendienteCompra(c)])));

  async function guardar() {
    if (!prov) return toast.error("Elegí el proveedor");
    if (total <= 0) return toast.error("Indicá cuánto pagás");
    if (medio === "efectivo" && !caja) return toast.error("Para pagar en efectivo abrí la caja");
    setGuardando(true);
    try {
      await registrarPagoProveedor({
        proveedor_id: prov,
        medio,
        aplicaciones: Object.entries(montos)
          .filter(([, v]) => v > 0)
          .map(([compra_id, monto]) => ({ compra_id, monto })),
        a_cuenta: aCuenta || 0,
        notas,
      });
      toast.success(`Pago de ${money(total)} registrado`);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={abierto} onClose={onClose} title="Registrar pago a proveedor" size="lg">
      <div className="space-y-4">
        <Field label="Proveedor">
          <select
            className="input"
            value={prov}
            onChange={(e) => {
              setProv(e.target.value);
              setMontos({});
            }}
          >
            <option value="">Elegir…</option>
            {[...proveedores]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
          {saldo && (
            <span className="mt-1 block text-xs text-slate-500">
              Saldo actual: {saldo.saldo < 0 ? `${money(-saldo.saldo)} a favor tuyo` : `${money(saldo.saldo)} (le debés al proveedor)`}
            </span>
          )}
        </Field>

        {prov && (
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between p-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">Facturas con saldo</span>
              {facturas.length > 0 && (
                <span className="flex gap-3 text-sm">
                  <button className="text-brand-600 hover:underline" onClick={marcarTodas}>
                    Marcar todas
                  </button>
                  <button className="text-slate-500 hover:underline" onClick={() => setMontos({})}>
                    Limpiar
                  </button>
                </span>
              )}
            </div>
            {facturas.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-slate-500">No hay facturas pendientes. Podés registrar un pago a cuenta (anticipo).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Vto.</th>
                      <th className="text-right">Saldo pendiente</th>
                      <th className="w-36 text-right">Monto a pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((c) => {
                      const pend = pendienteCompra(c);
                      const marcado = (montos[c.id] ?? 0) > 0;
                      return (
                        <tr key={c.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={(e) => setMontos((m) => ({ ...m, [c.id]: e.target.checked ? pend : 0 }))}
                            />
                          </td>
                          <td className="font-mono text-xs">{c.comprobante || "s/n"}</td>
                          <td className="text-xs">{fecha(c.fecha)}</td>
                          <td className={`text-xs ${c.vence && c.vence < hoy ? "font-semibold text-rose-600" : ""}`}>{dmy(c.vence)}</td>
                          <td className="text-right tabular-nums">
                            {money(pend)}
                            {Number(c.pagado) > 0 && <div className="text-xs text-slate-400">de {money(c.total)}</div>}
                          </td>
                          <td>
                            <NumInput
                              className="input py-1 text-right"
                              placeholder="0"
                              value={montos[c.id] ?? 0}
                              onChange={(n) => setMontos((m) => ({ ...m, [c.id]: Math.max(0, Math.min(pend, n)) }))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <Field label="Pago a cuenta (sin asignar a factura)">
          <NumInput className="input max-w-[12rem] text-right" placeholder="0" value={aCuenta} onChange={(n) => setACuenta(Math.max(0, n))} />
          <span className="mt-1 block text-xs text-slate-500">Para un anticipo o un pago que no corresponde a una factura puntual: baja el saldo del proveedor.</span>
        </Field>

        <div>
          <span className="label">Método de pago</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {MEDIOS.map((m) => {
              const deshabilitado = m.id === "efectivo" && !caja;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => setMedio(m.id)}
                  className={`rounded-lg border p-3 text-left text-sm transition ${
                    medio === m.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 hover:bg-slate-50"
                  } ${deshabilitado ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-slate-500">{deshabilitado ? "Necesitás una caja abierta" : m.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Notas (opcional)">
          <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: transferencia Banco Nación, cheque N° 123…" />
        </Field>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <span className="font-semibold">Total a pagar</span>
          <span className="text-xl font-bold tabular-nums">{money(total)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={guardando || total <= 0 || !prov} onClick={guardar}>
            {guardando ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
