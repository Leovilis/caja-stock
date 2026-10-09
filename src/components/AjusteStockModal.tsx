"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { moverStock } from "@/lib/db";
import { number } from "@/lib/format";
import type { Producto } from "@/lib/types";
import { Field, Modal, NumInput } from "./ui";

export function AjusteStockModal({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const [tipo, setTipo] = useState<"ajuste" | "compra" | "merma" | "vencido">("ajuste");
  const [valor, setValor] = useState(0);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (producto) {
      setTipo("ajuste");
      setValor(Number(producto.stock));
      setMotivo("");
    }
  }, [producto]);

  if (!producto) return null;
  const stock = Number(producto.stock);
  const resultado = tipo === "ajuste" ? valor : tipo === "compra" ? stock + valor : stock - Math.abs(valor);

  return (
    <Modal open={!!producto} onClose={onClose} title={`Stock: ${producto.nombre}`} size="sm">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await moverStock(producto.id, tipo, valor, motivo);
            toast.success("Stock actualizado");
            onClose();
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["ajuste", "Inventario (conteo)"],
              ["compra", "Ingreso"],
              ["merma", "Rotura / pérdida"],
              ["vencido", "Vencido"],
            ] as const
          ).map(([t, l]) => (
            <button
              type="button"
              key={t}
              className={tipo === t ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
              onClick={() => {
                setTipo(t);
                setValor(t === "ajuste" ? stock : 0);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <Field label={tipo === "ajuste" ? "Stock real contado" : "Cantidad"}>
          <NumInput value={valor} onChange={setValor} autoFocus />
        </Field>
        <Field label="Motivo / nota">
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        <div className="text-sm text-slate-500">
          Stock actual <b>{number(stock)}</b> → nuevo <b>{number(resultado)}</b>
        </div>
        <button className="btn-primary w-full">Guardar</button>
      </form>
    </Modal>
  );
}
