"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, PlugZap, Printer, Save, X, XCircle } from "lucide-react";
import { certificadoArca, estadoArca, subirCertificadoArca, type InfoCertificado } from "@/lib/arca/cliente";
import { useApp } from "@/context/AppContext";
import { guardarConfig } from "@/lib/db";
import { imprimirTicket } from "@/lib/ticket";
import type { Config, MedioConfig, Venta } from "@/lib/types";
import { comisionDe, conRecargo, mediosDe } from "@/lib/types";
import { money } from "@/lib/format";
import { Field, NumInput, PageHeader } from "@/components/ui";
import { ALICUOTAS, cuitValido } from "@/lib/arca/calculo";

function ListaEditable({ titulo, items, onChange }: { titulo: string; items: string[]; onChange: (v: string[]) => void }) {
  const [nuevo, setNuevo] = useState("");
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold">{titulo}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <span key={c} className="badge gap-1 bg-slate-100 py-1 text-slate-700">
            {c}
            <button onClick={() => onChange(items.filter((x) => x !== c))} className="text-slate-400 hover:text-rose-600">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = nuevo.trim();
          if (v && !items.includes(v)) onChange([...items, v]);
          setNuevo("");
        }}
      >
        <input className="input" placeholder="Agregar…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        <button className="btn-ghost">Agregar</button>
      </form>
    </div>
  );
}

export default function ConfigPage() {
  const { config, modulo } = useApp();
  const [f, setF] = useState<Config>(config);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [diag, setDiag] = useState<{ paso: string; ok: boolean; detalle: string }[] | null>(null);
  useEffect(() => setF(config), [config]);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setGuardando(true);
    try {
      await guardarConfig(f);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  function prueba() {
    const v: Venta = {
      id: "prueba",
      numero: 123,
      fecha: new Date().toISOString(),
      venta_items: [
        { producto_id: "x", nombre: "Gaseosa cola 500ml", codigo: "", cantidad: 2, precio: 1500, costo: 0, subtotal: 3000, categoria: "" },
        { producto_id: "y", nombre: "Papas fritas 80g", codigo: "", cantidad: 1, precio: 1800, costo: 0, subtotal: 1800, categoria: "" },
      ],
      subtotal: 4800,
      descuento: 0,
      total: 4800,
      costo_total: 0,
      pagos: [{ medio: "efectivo", monto: 4800 }],
      recibido: 5000,
      vuelto: 200,
      caja_id: "",
      usuario_id: "",
      usuario_nombre: "Prueba",
      estado: "completada",
    };
    imprimirTicket(v, f);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configuración">
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          <Save size={16} /> Guardar cambios
        </button>
      </PageHeader>

      <div className="space-y-6">
        <div className="card grid gap-3 p-5 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Datos del negocio (aparecen en el ticket)</h3>
          <Field label="Nombre del negocio">
            <input className="input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>
          <Field label="CUIT">
            <input className="input" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <input className="input" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input className="input" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </Field>
          <Field label="Pie del ticket" className="sm:col-span-2">
            <input className="input" value={f.pie_ticket} onChange={(e) => set("pie_ticket", e.target.value)} />
          </Field>
        </div>

        <MediosPagoCard
          medios={f.medios_pago}
          alias={f.alias_transferencia}
          onMedios={(v) => set("medios_pago", v)}
          onAlias={(v) => set("alias_transferencia", v)}
        />

        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Caja e impresión</h3>
          <Field label="Ancho de la impresora térmica">
            <select className="input" value={f.ancho_ticket} onChange={(e) => set("ancho_ticket", Number(e.target.value) as 58 | 80)}>
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-ghost" onClick={prueba}>
              <Printer size={16} /> Imprimir ticket de prueba
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.imprimir_automatico} onChange={(e) => set("imprimir_automatico", e.target.checked)} />
            Imprimir ticket automáticamente al confirmar la venta
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.permitir_stock_negativo} onChange={(e) => set("permitir_stock_negativo", e.target.checked)} />
            Permitir vender sin stock (el stock queda negativo)
          </label>
          <Field label="Avisar vencimientos con (días de anticipación)">
            <NumInput value={f.dias_aviso_vencimiento} onChange={(n) => set("dias_aviso_vencimiento", Math.max(0, Math.min(90, Math.round(n))))} />
          </Field>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Tip: en Chrome podés imprimir sin el cuadro de diálogo iniciando el navegador con <code>--kiosk-printing</code> y dejando la térmica como impresora predeterminada.
          </p>
        </div>

        {modulo("facturacion") && (
        <div className="card grid gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h3 className="font-semibold">Facturación electrónica (ARCA)</h3>
            <p className="text-xs text-slate-500">
              Las facturas se emiten a pedido desde <b>Ventas</b> o al terminar una venta. Cargá abajo el certificado digital de ARCA de este comercio (ver manual).
            </p>
          </div>
          <Field label="Condición frente al IVA">
            <select className="input" value={f.fiscal_condicion} onChange={(e) => set("fiscal_condicion", e.target.value as Config["fiscal_condicion"])}>
              <option value="monotributo">Monotributo (Factura C)</option>
              <option value="responsable_inscripto">Responsable Inscripto (Factura A y B)</option>
            </select>
          </Field>
          <Field label="CUIT del emisor">
            <input className={`input ${f.fiscal_cuit && !cuitValido(f.fiscal_cuit) ? "border-rose-400" : ""}`} value={f.fiscal_cuit} onChange={(e) => set("fiscal_cuit", e.target.value.replace(/[^\d-]/g, ""))} placeholder="20-12345678-9" />
          </Field>
          <Field label="Razón social (como figura en ARCA)">
            <input className="input" value={f.fiscal_razon_social} onChange={(e) => set("fiscal_razon_social", e.target.value)} />
          </Field>
          <Field label="Domicilio comercial">
            <input className="input" value={f.fiscal_domicilio} onChange={(e) => set("fiscal_domicilio", e.target.value)} />
          </Field>
          <Field label="Ingresos Brutos">
            <input className="input" value={f.fiscal_iibb} onChange={(e) => set("fiscal_iibb", e.target.value)} placeholder="N° o Exento / Convenio multilateral" />
          </Field>
          <Field label="Inicio de actividades">
            <input type="date" className="input" value={f.fiscal_inicio_actividades ?? ""} onChange={(e) => set("fiscal_inicio_actividades", e.target.value || null)} />
          </Field>
          <Field label="Punto de venta (web service)">
            <NumInput value={f.fiscal_punto_venta} onChange={(n) => set("fiscal_punto_venta", Math.max(1, Math.round(n)))} />
          </Field>
          <Field label="Ambiente">
            <select
              className="input"
              value={f.fiscal_ambiente}
              onChange={(e) => {
                const v = e.target.value as Config["fiscal_ambiente"];
                if (v === "produccion" && !confirm("En PRODUCCIÓN las facturas tienen validez fiscal y no se pueden borrar. ¿Confirmás?")) return;
                set("fiscal_ambiente", v);
              }}
            >
              <option value="homologacion">Homologación (pruebas, sin validez fiscal)</option>
              <option value="produccion">Producción (facturas reales)</option>
            </select>
          </Field>
          {f.fiscal_condicion === "responsable_inscripto" && (
            <Field label="IVA de los ítems «Varios»">
              <select className="input" value={f.alicuota_varios} onChange={(e) => set("alicuota_varios", Number(e.target.value))}>
                {ALICUOTAS.map((a) => (
                  <option key={a} value={a}>
                    {String(a).replace(".", ",")} %
                  </option>
                ))}
              </select>
            </Field>
          )}
          <CertificadoArca />
          <div className="sm:col-span-2">
            <button
              className="btn-ghost"
              disabled={probando}
              onClick={async () => {
                setProbando(true);
                setDiag(null);
                try {
                  await guardarConfig(f);
                  const r = await estadoArca();
                  setDiag(r.pasos);
                  if (r.ok) toast.success("Conexión con ARCA OK");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setProbando(false);
                }
              }}
            >
              <PlugZap size={16} /> {probando ? "Probando…" : "Guardar y probar conexión con ARCA"}
            </button>
            {diag && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {diag.map((d) => (
                  <li key={d.paso} className="flex gap-2">
                    {d.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />}
                    <span>
                      <b>{d.paso}:</b> <span className={d.ok ? "text-slate-600" : "text-rose-700"}>{d.detalle}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <ListaEditable titulo="Categorías de productos" items={f.categorias_producto} onChange={(v) => set("categorias_producto", v)} />
          {modulo("gastos") && (
            <ListaEditable titulo="Categorías de gastos" items={f.categorias_gasto} onChange={(v) => set("categorias_gasto", v)} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Carga del certificado digital de ARCA del comercio (se guarda cifrado; la clave nunca vuelve al navegador) */
function CertificadoArca() {
  const [info, setInfo] = useState<InfoCertificado | null>(null);
  const [cert, setCert] = useState("");
  const [key, setKey] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  useEffect(() => {
    certificadoArca()
      .then(setInfo)
      .catch(() => setInfo({ cargado: false }));
  }, []);

  const leer = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const r = new FileReader();
    r.onload = () => set(String(r.result ?? ""));
    r.readAsText(archivo);
  };

  async function subir() {
    if (!cert || !key) return toast.error("Elegí los dos archivos: certificado (.crt/.pem) y clave privada (.key)");
    setSubiendo(true);
    try {
      const r = await subirCertificadoArca(cert, key);
      setInfo({ ...r, cargado: true, corresponde: true });
      setCert("");
      setKey("");
      toast.success("Certificado guardado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
      <div className="mb-2 text-sm font-semibold">Certificado digital</div>
      {info === null ? (
        <p className="text-xs text-slate-500">Consultando…</p>
      ) : info.cargado ? (
        <p className="mb-2 text-xs text-emerald-700">
          Cargado: {info.cn} {info.cuit && `· CUIT ${info.cuit}`} · vence el {info.vence?.slice(0, 10).split("-").reverse().join("/")}
          {info.corresponde === false && <span className="text-rose-700"> · la clave no corresponde al certificado</span>}
        </p>
      ) : (
        <p className="mb-2 text-xs text-amber-700">Todavía no cargaste el certificado de este comercio.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Certificado (.crt / .pem)
          <input type="file" accept=".crt,.pem,.cer,.txt" className="mt-1 block w-full text-xs" onChange={leer(setCert)} />
        </label>
        <label className="text-xs text-slate-600">
          Clave privada (.key)
          <input type="file" accept=".key,.pem,.txt" className="mt-1 block w-full text-xs" onChange={leer(setKey)} />
        </label>
      </div>
      <button type="button" className="btn-ghost btn-sm mt-2" onClick={subir} disabled={subiendo || !cert || !key}>
        {subiendo ? "Guardando…" : info?.cargado ? "Reemplazar certificado" : "Guardar certificado"}
      </button>
    </div>
  );
}

/** Recargo/descuento al cliente y comisión del procesador por medio de pago, más alias para transferencias */
function MediosPagoCard({
  medios,
  alias,
  onMedios,
  onAlias,
}: {
  medios: MedioConfig[];
  alias: string;
  onMedios: (v: MedioConfig[]) => void;
  onAlias: (v: string) => void;
}) {
  const filas = mediosDe({ medios_pago: medios });
  const cambiar = (id: string, cambio: Partial<MedioConfig>) => {
    const nuevas = filas.map((m) => (m.id === id ? { ...m, ...cambio } : m));
    if (!nuevas.some((m) => m.activo)) return toast.error("Tiene que quedar al menos un medio de pago activo");
    onMedios(nuevas.map(({ id, activo, recargo, comision }) => ({ id, activo, recargo, comision })));
  };
  const transferencia = filas.find((m) => m.id === "transferencia");

  return (
    <div className="card p-5">
      <h3 className="font-semibold">Medios de pago</h3>
      <p className="mb-3 text-xs text-slate-500">
        <b>Recargo</b>: lo que le sumás al cliente por pagar con ese medio (negativo = descuento, ej. −5 en efectivo). <b>Comisión</b>: lo que te retiene el procesador
        (Mercado Pago, posnet), sin IVA. Revisá tus condiciones reales en el panel de cada uno. Con esto la caja cobra el monto correcto y los reportes muestran tu
        ganancia real.
      </p>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Medio</th>
              <th className="text-center">Activo</th>
              <th className="w-32">Recargo / desc. %</th>
              <th className="w-32">Comisión % (sin IVA)</th>
              <th className="text-right">Con IVA</th>
              <th className="text-right">De $1.000 te quedan</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => {
              const cobrado = conRecargo(1000, m);
              const neto = cobrado - comisionDe(cobrado, m);
              const tono = neto >= 1000 ? "text-emerald-600" : neto >= 970 ? "text-amber-600" : "text-rose-600";
              return (
                <tr key={m.id} className={m.activo ? "" : "opacity-50"}>
                  <td className="font-medium">{m.label}</td>
                  <td className="text-center">
                    <input type="checkbox" checked={m.activo} onChange={(e) => cambiar(m.id, { activo: e.target.checked })} />
                  </td>
                  <td>
                    <NumInput className="input py-1 text-right" placeholder="0" value={m.recargo} onChange={(n) => cambiar(m.id, { recargo: Math.max(-50, Math.min(100, n)) })} />
                  </td>
                  <td>
                    <NumInput className="input py-1 text-right" placeholder="0" value={m.comision} onChange={(n) => cambiar(m.id, { comision: Math.max(0, Math.min(50, n)) })} />
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{(m.comision * 1.21).toFixed(2).replace(".", ",")} %</td>
                  <td className={`text-right font-semibold tabular-nums ${tono}`}>{money(neto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Verde: el recargo cubre la comisión. Ámbar: perdés hasta 3 %. Rojo: perdés más. La comisión se calcula con IVA (21 %).
      </p>
      {transferencia?.activo && (
        <Field label="Alias / CBU para transferencias (se muestra al cobrar)" className="mt-4 max-w-md">
          <input className="input" value={alias} onChange={(e) => onAlias(e.target.value)} placeholder="ej: kiosco.la.esquina" />
        </Field>
      )}
    </div>
  );
}
