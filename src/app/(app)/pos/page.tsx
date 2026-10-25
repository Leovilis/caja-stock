"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FileCheck2, Barcode, Minus, Plus, Printer, Search, ShoppingCart, Star, Trash2, Wallet, PlusCircle, Percent } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { abrirCaja, registrarVenta, type ItemCarrito } from "@/lib/db";
import { money, round2, number } from "@/lib/format";
import { imprimirTicket } from "@/lib/ticket";
import { MEDIOS_PAGO, MedioPago, Pago, Producto, Venta, facturacionConfigurada, comisionDe, conRecargo, mediosDe, type MedioConfig } from "@/lib/types";
import { FacturarModal } from "@/components/FacturarModal";

interface CarritoItem extends ItemCarrito {
  codigo: string;
  subtotal: number;
}
import { Modal, NumInput, Field, Badge } from "@/components/ui";

const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const CARRITO_KEY = "pos-carrito-v2";

export default function POSPage() {
  const { caja, config, modulo } = useApp();
  const { data: productos } = useQuery<Producto>(() => supabase.from("productos").select("*").eq("activo", true), ["productos"]);

  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [cobrando, setCobrando] = useState(false);
  const [modalVarios, setModalVarios] = useState(false);
  const [modalDesc, setModalDesc] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<Venta | null>(null);
  const [ultimaFacturada, setUltimaFacturada] = useState(false);
  const [facturando, setFacturando] = useState<Venta | null>(null);
  const [seleccion, setSeleccion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recuperar carrito si se recargó la página
  useEffect(() => {
    try {
      const s = localStorage.getItem(CARRITO_KEY);
      if (s) setCarrito(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
    } catch {}
  }, [carrito]);

  const porCodigo = useMemo(() => {
    const m = new Map<string, Producto>();
    productos.forEach((p) => p.codigo && m.set(p.codigo.trim(), p));
    return m;
  }, [productos]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  // Si el admin cambia un precio mientras hay un ticket abierto, se actualiza solo
  useEffect(() => {
    setCarrito((c) => {
      let cambio = false;
      const nuevo = c.map((i) => {
        const p = i.producto_id ? porId.get(i.producto_id) : undefined;
        if (p && Number(p.precio) !== i.precio) {
          cambio = true;
          return { ...i, precio: Number(p.precio), subtotal: round2(Number(p.precio) * i.cantidad) };
        }
        return i;
      });
      return cambio ? nuevo : c;
    });
  }, [porId]);

  const resultados = useMemo(() => {
    const q = norm(busqueda.replace(/^\d+(?:[.,]\d+)?\*/, "").trim());
    if (!q) return productos.filter((p) => p.favorito).slice(0, 24);
    const palabras = q.split(/\s+/);
    return productos
      .filter((p) => {
        const t = norm(`${p.nombre} ${p.codigo} ${p.marca ?? ""} ${p.categoria}`);
        return palabras.every((w) => t.includes(w));
      })
      .slice(0, 40);
  }, [busqueda, productos]);

  useEffect(() => setSeleccion(0), [busqueda]);

  const foco = useCallback(() => setTimeout(() => inputRef.current?.focus(), 30), []);

  const agregar = useCallback(
    (p: Producto, cantidad = 1) => {
      const enCarrito = carrito.filter((i) => i.producto_id === p.id).reduce((a, i) => a + i.cantidad, 0);
      if (!config.permitir_stock_negativo && enCarrito + cantidad > p.stock) {
        toast.error(`Sin stock suficiente de ${p.nombre} (quedan ${number(p.stock)})`);
        return;
      }
      setCarrito((c) => {
        const idx = c.findIndex((i) => i.producto_id === p.id);
        if (idx >= 0) {
          const copia = [...c];
          const it = copia[idx];
          const cant = round2(it.cantidad + cantidad);
          copia[idx] = { ...it, cantidad: cant, subtotal: round2(cant * it.precio) };
          // el último agregado arriba
          copia.unshift(copia.splice(idx, 1)[0]);
          return copia;
        }
        return [
          {
            producto_id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            cantidad,
            precio: Number(p.precio),
            subtotal: round2(Number(p.precio) * cantidad),
          },
          ...c,
        ];
      });
      if (p.stock - enCarrito - cantidad <= p.stock_min && p.stock_min > 0) {
        toast(`⚠️ ${p.nombre}: stock bajo`, { duration: 1500 });
      }
    },
    [carrito, config.permitir_stock_negativo]
  );

  function onEnter() {
    const raw = busqueda.trim();
    if (!raw) {
      if (carrito.length) setCobrando(true);
      return;
    }
    // Soporta "3*7790895000997" para cantidad
    const m = raw.match(/^(\d+(?:[.,]\d+)?)\*(.*)$/);
    const cant = m ? Number(m[1].replace(",", ".")) : 1;
    const codigo = (m ? m[2] : raw).trim();
    const exacto = porCodigo.get(codigo);
    if (exacto) {
      agregar(exacto, cant);
      setBusqueda("");
      return;
    }
    if (resultados[seleccion]) {
      agregar(resultados[seleccion], cant);
      setBusqueda("");
      return;
    }
    toast.error(`No se encontró "${codigo}"`);
    setBusqueda("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSeleccion((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSeleccion((s) => Math.max(s - 1, 0));
    }
  }

  // Atajos globales
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        setModalVarios(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (carrito.length) setModalDesc(true);
      } else if (e.key === "F12") {
        e.preventDefault();
        if (carrito.length) setCobrando(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [carrito.length]);

  const cambiarCant = (idx: number, cant: number) => {
    setCarrito((c) => {
      const copia = [...c];
      const it = copia[idx];
      if (cant <= 0) return copia.filter((_, i) => i !== idx);
      const p = it.producto_id ? porId.get(it.producto_id) : null;
      if (p && !config.permitir_stock_negativo && cant > p.stock) {
        toast.error(`Stock disponible: ${number(p.stock)}`);
        return c;
      }
      copia[idx] = { ...it, cantidad: round2(cant), subtotal: round2(cant * it.precio) };
      return copia;
    });
  };

  const subtotal = round2(carrito.reduce((a, i) => a + i.subtotal, 0));
  const total = round2(Math.max(0, subtotal - descuento));
  const unidades = carrito.reduce((a, i) => a + i.cantidad, 0);
  const medios = useMemo(() => mediosDe(config), [config]);
  const costoTicket = useMemo(() => {
    const porId = new Map(productos.map((p) => [p.id, Number(p.costo)]));
    return round2(carrito.reduce((a, i) => a + (i.producto_id ? (porId.get(i.producto_id) ?? 0) * i.cantidad : 0), 0));
  }, [carrito, productos]);

  function vaciar() {
    setCarrito([]);
    setDescuento(0);
    foco();
  }

  async function confirmarVenta(pagos: Pago[], recibido: number, vuelto: number) {
    if (!caja) return;
    try {
      const v = await registrarVenta(carrito, descuento, pagos, recibido, vuelto);
      setUltimaVenta(v);
      setUltimaFacturada(false);
      setCobrando(false);
      vaciar();
      toast.success(`Venta #${v.numero} registrada${vuelto ? ` · Vuelto ${money(vuelto)}` : ""}`);
      if (config.imprimir_automatico) imprimirTicket(v, config);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!caja) return <AbrirCajaInline />;

  return (
    <div className="grid grid-cols-1 gap-3 lg:h-[calc(100vh-2rem)] lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* Izquierda: búsqueda y productos */}
      <section className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="card flex items-center gap-2 p-2">
          <Barcode className="ml-2 text-slate-400" />
          <input
            ref={inputRef}
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escaneá el código o buscá por nombre…  (ej: 6*7790895000997)"
            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-lg outline-none"
          />
          <button className="btn-ghost" onClick={() => setModalVarios(true)} title="F4">
            <PlusCircle size={16} /> <span className="hidden sm:inline">Varios</span>
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-slate-500">
          <span>
            {busqueda ? `${resultados.length} resultados` : (
              <span className="inline-flex items-center gap-1">
                <Star size={12} /> Favoritos (marcalos en Productos)
              </span>
            )}
          </span>
          <span className="hidden md:inline">F2 buscar · F4 varios · F8 descuento · F12 / Enter vacío: cobrar</span>
        </div>

        <div className="max-h-[45vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {resultados.map((p, i) => {
              const sinStock = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    agregar(p);
                    setBusqueda("");
                    foco();
                  }}
                  className={`card flex flex-col p-3 text-left transition hover:border-brand-500 hover:shadow ${
                    i === seleccion && busqueda ? "ring-2 ring-brand-500" : ""
                  } ${sinStock ? "opacity-60" : ""}`}
                >
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{p.nombre}</span>
                  <span className="mt-1 text-xs text-slate-400">{p.categoria}</span>
                  <span className="mt-auto flex items-end justify-between pt-2">
                    <span className="text-lg font-bold text-brand-700">{money(p.precio)}</span>
                    <span className={`text-xs ${p.stock <= p.stock_min ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                      {number(p.stock)} u.
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {busqueda && resultados.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">Sin resultados. Presioná Enter para buscar por código exacto.</div>
          )}
        </div>
      </section>

      {/* Derecha: ticket */}
      <section className="card flex min-h-[320px] flex-col lg:min-h-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={18} /> Ticket actual
            {carrito.length > 0 && <Badge tone="blue">{number(unidades)} u.</Badge>}
          </div>
          {carrito.length > 0 && (
            <button className="text-xs text-rose-600 hover:underline" onClick={vaciar}>
              Vaciar
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {carrito.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-400">
              <Search />
              Escaneá un producto para empezar
              {ultimaVenta && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => imprimirTicket(ultimaVenta, config)}>
                    <Printer size={14} /> Reimprimir ticket #{ultimaVenta.numero}
                  </button>
                  {modulo("facturacion") && facturacionConfigurada(config) && !ultimaFacturada && (
                    <button className="btn-primary btn-sm" onClick={() => setFacturando(ultimaVenta)}>
                      <FileCheck2 size={14} /> Facturar #{ultimaVenta.numero}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {carrito.map((it, idx) => (
                <li key={(it.producto_id ?? "v") + idx} className="px-4 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{it.nombre}</span>
                    <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{money(it.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button className="rounded border border-slate-300 p-1 hover:bg-slate-100" onClick={() => cambiarCant(idx, it.cantidad - 1)}>
                        <Minus size={12} />
                      </button>
                      <input
                        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center text-sm"
                        type="number"
                        step="any"
                        value={it.cantidad}
                        onChange={(e) => cambiarCant(idx, Number(e.target.value))}
                      />
                      <button className="rounded border border-slate-300 p-1 hover:bg-slate-100" onClick={() => cambiarCant(idx, it.cantidad + 1)}>
                        <Plus size={12} />
                      </button>
                      <span className="ml-2 text-xs text-slate-500">× {money(it.precio)}</span>
                    </div>
                    <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => cambiarCant(idx, 0)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1 border-t border-slate-200 p-4">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <button className="flex items-center gap-1 text-brand-600 hover:underline disabled:text-slate-400" disabled={!carrito.length} onClick={() => setModalDesc(true)}>
              <Percent size={12} /> Descuento
            </button>
            <span className="tabular-nums text-rose-600">{descuento ? `-${money(descuento)}` : "—"}</span>
          </div>
          <div className="flex items-end justify-between pt-1">
            <span className="text-lg font-semibold">TOTAL</span>
            <span className="text-3xl font-bold tabular-nums text-slate-900">{money(total)}</span>
          </div>
          <button className="btn-success mt-2 w-full py-4 text-lg" disabled={!carrito.length} onClick={() => setCobrando(true)}>
            <Wallet /> Cobrar (F12)
          </button>
        </div>
      </section>

      <CobroModal
        open={cobrando}
        total={total}
        costo={costoTicket}
        medios={medios}
        alias={config.alias_transferencia}
        onClose={() => { setCobrando(false); foco(); }}
        onConfirm={confirmarVenta}
      />

      <FacturarModal venta={facturando} onClose={() => { setFacturando(null); foco(); }} onListo={() => setUltimaFacturada(true)} />

      <VariosModal
        open={modalVarios}
        onClose={() => { setModalVarios(false); foco(); }}
        onAdd={(nombre, precio, cant) => {
          setCarrito((c) => [
            { producto_id: null, nombre, codigo: "", cantidad: cant, precio, subtotal: round2(precio * cant) },
            ...c,
          ]);
          setModalVarios(false);
          foco();
        }}
      />

      <DescuentoModal
        open={modalDesc}
        subtotal={subtotal}
        actual={descuento}
        onClose={() => { setModalDesc(false); foco(); }}
        onApply={(d) => {
          setDescuento(d);
          setModalDesc(false);
          foco();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AbrirCajaInline() {
  const [monto, setMonto] = useState(0);
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm p-6 text-center">
        <Wallet className="mx-auto text-brand-600" size={40} />
        <h2 className="mt-3 text-xl font-bold">La caja está cerrada</h2>
        <p className="mt-1 text-sm text-slate-500">Abrí la caja con el efectivo inicial (cambio) para empezar a vender.</p>
        <form
          className="mt-5 space-y-3 text-left"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            try {
              await abrirCaja(monto);
              toast.success("Caja abierta");
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setEnviando(false);
            }
          }}
        >
          <Field label="Efectivo inicial en caja">
            <NumInput value={monto} onChange={setMonto} autoFocus placeholder="0" />
          </Field>
          <button className="btn-primary w-full" disabled={enviando}>
            Abrir caja
          </button>
        </form>
      </div>
    </div>
  );
}

function CobroModal({
  open,
  total,
  costo,
  medios,
  alias,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number; // total del ticket (antes del recargo por medio de pago)
  costo: number; // costo de la mercadería del ticket (para avisar si queda a pérdida)
  medios: (MedioConfig & { label: string })[];
  alias: string;
  onClose: () => void;
  onConfirm: (pagos: Pago[], recibido: number, vuelto: number) => Promise<void>;
}) {
  const activos = medios.filter((m) => m.activo);
  const inicial = (activos.find((m) => m.id === "efectivo") ?? activos[0])?.id ?? "efectivo";
  const vacio = () => Object.fromEntries(MEDIOS_PAGO.map((m) => [m.id, 0])) as Record<MedioPago, number>;
  const [medio, setMedio] = useState<MedioPago>(inicial);
  const [recibido, setRecibido] = useState(0);
  const [dividido, setDividido] = useState(false);
  const [pagos, setPagos] = useState<Record<MedioPago, number>>(vacio);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setMedio(inicial);
      setRecibido(0);
      setDividido(false);
      setPagos(vacio());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cfg = (id: MedioPago) => medios.find((m) => m.id === id);
  // partes del ticket que paga cada medio (sin recargo) y lo que efectivamente se cobra con cada uno
  const partes: [MedioPago, number][] = dividido
    ? (Object.entries(pagos) as [MedioPago, number][]).filter(([, v]) => v > 0)
    : [[medio, total]];
  const cobrados = partes.map(([m, base]) => ({ m, base, cobrado: conRecargo(base, cfg(m)) }));
  const aCobrar = round2(cobrados.reduce((a, c) => a + c.cobrado, 0));
  const ajuste = round2(aCobrar - (dividido ? cobrados.reduce((a, c) => a + c.base, 0) : total));
  const comision = round2(cobrados.reduce((a, c) => a + comisionDe(c.cobrado, cfg(c.m)), 0));
  const teQueda = round2(aCobrar - comision);

  const sumaDiv = round2(Object.values(pagos).reduce((a, b) => a + b, 0));
  const efectivoAplicado = cobrados.find((c) => c.m === "efectivo")?.cobrado ?? 0;
  const recibidoReal = recibido || efectivoAplicado;
  const vuelto = efectivoAplicado > 0 ? round2(Math.max(0, recibidoReal - efectivoAplicado)) : 0;
  const falta = dividido ? round2(total - sumaDiv) : 0;
  const valido = dividido ? Math.abs(falta) < 0.01 : medio !== "efectivo" || recibidoReal >= aCobrar;
  const perdida = costo > 0 && teQueda < costo;
  const usaTransferencia = cobrados.some((c) => c.m === "transferencia");

  async function confirmar() {
    if (!valido || enviando) return;
    setEnviando(true);
    // se mandan las partes del ticket: la base calcula recargo y comisión con la configuración del comercio
    await onConfirm(
      partes.map(([m, base]) => ({ medio: m, monto: base })),
      efectivoAplicado > 0 ? recibidoReal : 0,
      vuelto
    );
    setEnviando(false);
  }

  const etiquetaRecargo = (m: MedioConfig) => (m.recargo ? `${m.recargo > 0 ? "+" : "−"}${Math.abs(m.recargo)}%` : "");
  const billetes = [1000, 2000, 5000, 10000, 20000].filter((b) => b >= aCobrar * 0.2);

  return (
    <Modal open={open} onClose={onClose} title="Cobrar" size="md">
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          }
        }}
      >
        <div className="mb-4 rounded-xl bg-slate-900 p-4 text-center text-white">
          <div className="text-xs uppercase tracking-wider text-slate-400">Total a cobrar</div>
          <div className="text-4xl font-bold tabular-nums">{money(aCobrar)}</div>
          {ajuste !== 0 && (
            <div className="mt-1 text-xs text-slate-300">
              Ticket {money(dividido ? sumaDiv : total)} {ajuste > 0 ? "+ recargo" : "− descuento"} {money(Math.abs(ajuste))}
            </div>
          )}
        </div>

        {activos.length > 1 && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dividido} onChange={(e) => setDividido(e.target.checked)} />
            Pago dividido (varios medios)
          </label>
        )}

        {!dividido ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {activos.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMedio(m.id)}
                  className={`rounded-lg border px-2 py-3 text-xs font-medium transition ${
                    medio === m.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                  {m.recargo !== 0 && <div className={m.recargo > 0 ? "text-rose-600" : "text-emerald-600"}>{etiquetaRecargo(m)}</div>}
                </button>
              ))}
            </div>
            {medio === "efectivo" && (
              <div className="mt-4 space-y-2">
                <Field label="Paga con">
                  <NumInput value={recibido} onChange={setRecibido} autoFocus placeholder={String(aCobrar)} className="input text-xl" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => setRecibido(aCobrar)}>
                    Exacto
                  </button>
                  {billetes.map((b) => (
                    <button key={b} className="btn-ghost btn-sm" onClick={() => setRecibido(b)}>
                      {money(b)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Cargá qué parte del ticket paga cada medio; el recargo se suma solo.</p>
            {activos.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-36 text-sm">
                  {m.label} {m.recargo !== 0 && <span className="text-xs text-slate-500">{etiquetaRecargo(m)}</span>}
                </span>
                <NumInput value={pagos[m.id]} placeholder="0" onChange={(n) => setPagos((p) => ({ ...p, [m.id]: n }))} />
                <button
                  className="btn-ghost btn-sm whitespace-nowrap"
                  onClick={() => setPagos((p) => ({ ...p, [m.id]: round2(p[m.id] + Math.max(0, total - sumaDiv)) }))}
                >
                  Resto
                </button>
                {m.recargo !== 0 && pagos[m.id] > 0 && (
                  <span className="w-28 text-right text-xs tabular-nums text-slate-600">cobrar {money(conRecargo(pagos[m.id], m))}</span>
                )}
              </div>
            ))}
            <div className={`text-right text-sm font-medium ${falta === 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {falta > 0 ? `Falta ${money(falta)}` : falta < 0 ? `Sobra ${money(-falta)}` : "Completo"}
            </div>
            {pagos.efectivo > 0 && (
              <Field label="Efectivo entregado por el cliente">
                <NumInput value={recibido} onChange={setRecibido} placeholder={String(efectivoAplicado)} />
              </Field>
            )}
          </div>
        )}

        {usaTransferencia && alias && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-brand-50 p-3">
            <div>
              <div className="text-xs uppercase text-brand-700">Transferir a</div>
              <div className="text-xl font-bold text-brand-700">{alias}</div>
            </div>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(alias).then(
                  () => toast.success("Alias copiado"),
                  () => toast.error("No se pudo copiar")
                );
              }}
            >
              Copiar
            </button>
          </div>
        )}

        {vuelto > 0 && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-center">
            <div className="text-xs uppercase text-emerald-700">Vuelto</div>
            <div className="text-3xl font-bold text-emerald-700 tabular-nums">{money(vuelto)}</div>
          </div>
        )}

        {perdida && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            Con este medio de pago la venta queda <b>a pérdida</b>: la mercadería cuesta {money(costo)} y, descontando la comisión ({money(comision)}), te quedan{" "}
            {money(teQueda)}.
          </div>
        )}

        <button className="btn-success mt-5 w-full py-3 text-base" disabled={!valido || enviando} onClick={confirmar}>
          {enviando ? "Registrando…" : "Confirmar venta (Enter)"}
        </button>
      </div>
    </Modal>
  );
}

function VariosModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (n: string, p: number, c: number) => void }) {
  const [nombre, setNombre] = useState("Varios");
  const [precio, setPrecio] = useState(0);
  const [cant, setCant] = useState(1);
  useEffect(() => {
    if (open) {
      setNombre("Varios");
      setPrecio(0);
      setCant(1);
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Ítem sin código (no descuenta stock)" size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (precio > 0 && cant > 0) onAdd(nombre || "Varios", precio, cant);
        }}
      >
        <Field label="Precio">
          <NumInput value={precio} onChange={setPrecio} autoFocus placeholder="0" />
        </Field>
        <Field label="Descripción">
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Cantidad">
          <NumInput value={cant} onChange={setCant} />
        </Field>
        <button className="btn-primary w-full">Agregar</button>
      </form>
    </Modal>
  );
}

function DescuentoModal({
  open,
  subtotal,
  actual,
  onClose,
  onApply,
}: {
  open: boolean;
  subtotal: number;
  actual: number;
  onClose: () => void;
  onApply: (d: number) => void;
}) {
  const [tipo, setTipo] = useState<"%" | "$">("%");
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (open) {
      setTipo("%");
      setValor(0);
    }
  }, [open]);
  const monto = round2(Math.min(subtotal, tipo === "%" ? (subtotal * valor) / 100 : valor));
  return (
    <Modal open={open} onClose={onClose} title="Descuento" size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(monto);
        }}
      >
        <div className="flex gap-2">
          {(["%", "$"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setTipo(t)} className={tipo === t ? "btn-primary flex-1" : "btn-ghost flex-1"}>
              {t === "%" ? "Porcentaje" : "Monto fijo"}
            </button>
          ))}
        </div>
        <NumInput value={valor} onChange={setValor} autoFocus placeholder="0" />
        <div className="text-sm text-slate-500">
          Descuento: <b>{money(monto)}</b> · Total: <b>{money(subtotal - monto)}</b>
        </div>
        <div className="flex gap-2">
          {actual > 0 && (
            <button type="button" className="btn-ghost flex-1" onClick={() => onApply(0)}>
              Quitar
            </button>
          )}
          <button className="btn-primary flex-1">Aplicar</button>
        </div>
      </form>
    </Modal>
  );
}
