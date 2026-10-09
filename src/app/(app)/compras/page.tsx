"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { registrarCompra } from "@/lib/db";
import { money, number, fechaHora, round2, isoDate, parseIsoDate, finDia, inicioMes } from "@/lib/format";
import type { Compra, ItemCompra, MedioPago, Producto, Proveedor } from "@/lib/types";
import { MEDIOS_PAGO, medioLabel } from "@/lib/types";
import { Empty, Field, Modal, NumInput, PageHeader, Stat } from "@/components/ui";

const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ComprasPage() {
  const [desde, setDesde] = useState(isoDate(inicioMes()));
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [nueva, setNueva] = useState(false);
  const [detalle, setDetalle] = useState<Compra | null>(null);
  const { data: compras } = useQuery<Compra>(
    () =>
      supabase
        .from("compras")
        .select("*")
        .gte("fecha", parseIsoDate(desde).toISOString())
        .lte("fecha", finDia(parseIsoDate(hasta)).toISOString())
        .order("fecha", { ascending: false }),
    ["compras"],
    `${desde}-${hasta}`
  );
  const total = compras.reduce((a, c) => a + Number(c.total), 0);
  const porProv = useMemo(() => {
    const m: Record<string, number> = {};
    compras.forEach((c) => (m[c.proveedor_nombre] = (m[c.proveedor_nombre] ?? 0) + c.total));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [compras]);

  return (
    <div>
      <PageHeader title="Compras" subtitle="Ingreso de mercadería de proveedores (suma stock y actualiza costos)">
        <input className="input w-auto" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className="input w-auto" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button className="btn-primary" onClick={() => setNueva(true)}>
          <Plus size={16} /> Nueva compra
        </button>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total comprado" value={money(total)} tone="blue" hint={`${compras.length} compras`} />
        <Stat label="Principal proveedor" value={porProv[0]?.[0] ?? "—"} hint={porProv[0] ? money(porProv[0][1]) : ""} />
        <Stat label="A cuenta corriente" value={money(compras.filter((c) => c.medio === "cuenta_corriente").reduce((a, c) => a + Number(c.total), 0))} tone="amber" hint="Pendiente de pago al proveedor" />
      </div>

      <div className="card overflow-x-auto">
        {compras.length === 0 ? (
          <Empty>Sin compras en el período</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Comprobante</th>
                <th>Ítems</th>
                <th>Pago</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs">{fechaHora(c.fecha)}</td>
                  <td className="font-medium">{c.proveedor_nombre}</td>
                  <td>{c.comprobante || "—"}</td>
                  <td>{c.items.length}</td>
                  <td>{medioLabel(c.medio)}{c.pagado_desde_caja ? " (caja)" : ""}</td>
                  <td className="text-right font-semibold tabular-nums">{money(c.total)}</td>
                  <td>
                    <button className="text-slate-400 hover:text-brand-600" onClick={() => setDetalle(c)}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NuevaCompraModal open={nueva} onClose={() => setNueva(false)} />
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Compra a ${detalle?.proveedor_nombre ?? ""}`} size="lg">
        {detalle && (
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">Costo u.</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle.items.map((i, k) => (
                <tr key={k}>
                  <td>{i.nombre}</td>
                  <td className="text-right">{number(i.cantidad)}</td>
                  <td className="text-right">{money(i.costo)}</td>
                  <td className="text-right">{money(i.subtotal)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={3}>Total</td>
                <td className="text-right">{money(detalle.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}

function NuevaCompraModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { caja } = useApp();
  const { data: productos } = useQuery<Producto>(() => supabase.from("productos").select("*").eq("activo", true), ["productos"], "", open);
  const { data: proveedores } = useQuery<Proveedor>(() => supabase.from("proveedores").select("*").order("nombre"), ["proveedores"], "", open);
  const [provId, setProvId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [q, setQ] = useState("");
  const [medio, setMedio] = useState<MedioPago | "cuenta_corriente">("efectivo");
  const [desdeCaja, setDesdeCaja] = useState(true);
  const [actCosto, setActCosto] = useState(true);
  const [mantenerMargen, setMantenerMargen] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const res = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const exacto = productos.find((p) => p.codigo === q.trim());
    if (exacto) return [exacto];
    return productos.filter((p) => norm(`${p.nombre} ${p.codigo}`).includes(t)).slice(0, 8);
  }, [q, productos]);

  const agregar = (p: Producto) => {
    setItems((it) => {
      const i = it.findIndex((x) => x.producto_id === p.id);
      if (i >= 0) {
        const c = [...it];
        c[i] = { ...c[i], cantidad: c[i].cantidad + 1, subtotal: round2((c[i].cantidad + 1) * c[i].costo) };
        return c;
      }
      return [...it, { producto_id: p.id, nombre: p.nombre, cantidad: 1, costo: Number(p.costo), subtotal: Number(p.costo) }];
    });
    setQ("");
  };
  const upd = (i: number, k: "cantidad" | "costo", v: number) =>
    setItems((it) => {
      const c = [...it];
      c[i] = { ...c[i], [k]: v };
      c[i].subtotal = round2(c[i].cantidad * c[i].costo);
      return c;
    });

  const total = round2(items.reduce((a, i) => a + i.subtotal, 0));
  const puedeCaja = !!caja && medio === "efectivo";

  async function guardar() {
    const prov = proveedores.find((p) => p.id === provId);
    if (!prov) return toast.error("Elegí el proveedor");
    if (!items.length) return toast.error("Agregá productos");
    setGuardando(true);
    try {
      await registrarCompra({
        proveedor_id: prov.id,
        comprobante,
        items: items.filter((i) => i.cantidad > 0).map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad, costo: i.costo })),
        medio,
        pagado_desde_caja: puedeCaja && desdeCaja,
        actualizar_costo: actCosto,
        mantener_margen: actCosto && mantenerMargen,
      });
      toast.success("Compra registrada y stock actualizado");
      setItems([]);
      setComprobante("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva compra / ingreso de mercadería" size="xl">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Proveedor">
          <select className="input" value={provId} onChange={(e) => setProvId(e.target.value)}>
            <option value="">Elegir…</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="N° factura / remito">
          <input className="input" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
        </Field>
        <Field label="Forma de pago">
          <select className="input" value={medio} onChange={(e) => setMedio(e.target.value as typeof medio)}>
            {MEDIOS_PAGO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value="cuenta_corriente">Cuenta corriente (a pagar)</option>
          </select>
        </Field>
      </div>

      <div className="relative mt-4">
        <input
          className="input"
          placeholder="Escaneá o buscá productos para agregar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (res[0]) agregar(res[0]);
            }
          }}
        />
        {res.length > 0 && (
          <div className="card absolute z-10 mt-1 w-full overflow-hidden">
            {res.map((p) => (
              <button key={p.id} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => agregar(p)}>
                <span>{p.nombre}</span>
                <span className="text-slate-400">
                  stock {number(p.stock)} · costo {money(p.costo)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 max-h-72 overflow-y-auto">
        {items.length === 0 ? (
          <Empty>Sin productos</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="w-28">Cantidad</th>
                <th className="w-36">Costo unitario</th>
                <th className="text-right">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.producto_id}>
                  <td>{it.nombre}</td>
                  <td>
                    <NumInput className="input py-1" value={it.cantidad} onChange={(n) => upd(i, "cantidad", n)} />
                  </td>
                  <td>
                    <NumInput className="input py-1" value={it.costo} onChange={(n) => upd(i, "costo", n)} />
                  </td>
                  <td className="text-right tabular-nums">{money(it.subtotal)}</td>
                  <td>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => setItems((x) => x.filter((_, k) => k !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-4">
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={actCosto} onChange={(e) => setActCosto(e.target.checked)} /> Actualizar costo de los productos
          </label>
          <label className={`flex items-center gap-2 ${actCosto ? "" : "opacity-40"}`}>
            <input type="checkbox" disabled={!actCosto} checked={mantenerMargen} onChange={(e) => setMantenerMargen(e.target.checked)} /> Si cambia el costo, mantener el margen (ajusta precio de venta)
          </label>
          <label className={`flex items-center gap-2 ${puedeCaja ? "" : "opacity-40"}`}>
            <input type="checkbox" disabled={!puedeCaja} checked={puedeCaja && desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} /> Pagado con efectivo de la caja abierta
          </label>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500">Total</div>
          <div className="text-2xl font-bold tabular-nums">{money(total)}</div>
          <button className="btn-primary mt-2" disabled={guardando} onClick={guardar}>
            Registrar compra
          </button>
        </div>
      </div>
    </Modal>
  );
}
