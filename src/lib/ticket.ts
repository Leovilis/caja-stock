import type { Config, Venta, Caja } from "./types";
import { medioLabel } from "./types";
import { money, fechaHora, number } from "./format";

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function imprimirHTML(html: string, ancho: number) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const d = iframe.contentWindow!.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>
  @page { size: ${ancho}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 3mm; width: ${ancho}mm; font-family: "Courier New", monospace; font-size: ${ancho === 58 ? 10 : 12}px; color: #000; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  .big { font-size: 1.35em; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
</style></head><body>${html}</body></html>`);
  d.close();
  setTimeout(() => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 1500);
  }, 250);
}

function encabezado(cfg: Config) {
  return `
    <div class="c b big">${escapeHtml(cfg.nombre)}</div>
    ${cfg.direccion ? `<div class="c">${escapeHtml(cfg.direccion)}</div>` : ""}
    ${cfg.telefono ? `<div class="c">Tel: ${escapeHtml(cfg.telefono)}</div>` : ""}
    ${cfg.cuit ? `<div class="c">CUIT: ${escapeHtml(cfg.cuit)}</div>` : ""}
    <hr/>`;
}

export function imprimirTicket(v: Venta, cfg: Config) {
  const filas = v.venta_items
    .map(
      (i) => `<tr><td colspan="2">${escapeHtml(i.nombre)}</td></tr>
      <tr><td>&nbsp;${number(i.cantidad)} x ${money(i.precio)}</td><td class="r">${money(i.subtotal)}</td></tr>`
    )
    .join("");
  const pagos = v.pagos.map((p) => `<tr><td>${medioLabel(p.medio)}</td><td class="r">${money(p.monto)}</td></tr>`).join("");
  imprimirHTML(
    `${encabezado(cfg)}
    <div>Ticket N° ${String(v.numero).padStart(8, "0")}</div>
    <div>${fechaHora(v.fecha)}</div>
    <div>Atendió: ${escapeHtml(v.usuario_nombre)}</div>
    ${v.estado === "anulada" ? '<div class="c b">*** ANULADA ***</div>' : ""}
    <hr/>
    <table>${filas}</table>
    <hr/>
    <table>
      ${v.descuento ? `<tr><td>Subtotal</td><td class="r">${money(v.subtotal)}</td></tr><tr><td>Descuento</td><td class="r">-${money(v.descuento)}</td></tr>` : ""}
      <tr class="b big"><td>TOTAL</td><td class="r">${money(v.total)}</td></tr>
    </table>
    <hr/>
    <table>${pagos}
      ${v.vuelto ? `<tr><td>Recibido</td><td class="r">${money(v.recibido)}</td></tr><tr class="b"><td>Vuelto</td><td class="r">${money(v.vuelto)}</td></tr>` : ""}
    </table>
    <hr/>
    <div class="c">${escapeHtml(cfg.pie_ticket)}</div>
    <div class="c" style="font-size:.85em;margin-top:4px">Comprobante no válido como factura</div>`,
    cfg.ancho_ticket
  );
}

export function imprimirCierreCaja(c: Caja, cfg: Config) {
  const medios = Object.entries(c.por_medio ?? {})
    .map(([m, v]) => `<tr><td>${medioLabel(m)}</td><td class="r">${money(v)}</td></tr>`)
    .join("");
  imprimirHTML(
    `${encabezado(cfg)}
    <div class="c b">CIERRE DE CAJA</div>
    <div>Apertura: ${fechaHora(c.apertura)} (${escapeHtml(c.abierta_por_nombre)})</div>
    <div>Cierre: ${fechaHora(c.cierre)} (${escapeHtml(c.cerrada_por_nombre ?? "")})</div>
    <hr/>
    <table>
      <tr><td>Ventas (${c.cant_ventas ?? 0})</td><td class="r b">${money(c.total_ventas)}</td></tr>
      ${medios}
    </table>
    <hr/>
    <table>
      <tr><td>Fondo inicial</td><td class="r">${money(c.monto_inicial)}</td></tr>
      <tr><td>+ Ingresos</td><td class="r">${money(c.ingresos)}</td></tr>
      <tr><td>- Egresos</td><td class="r">${money(c.egresos)}</td></tr>
      <tr class="b"><td>Efectivo esperado</td><td class="r">${money(c.efectivo_esperado)}</td></tr>
      <tr><td>Efectivo contado</td><td class="r">${money(c.efectivo_contado)}</td></tr>
      <tr class="b"><td>Diferencia</td><td class="r">${money(c.diferencia)}</td></tr>
    </table>
    ${c.observaciones ? `<hr/><div>Obs: ${escapeHtml(c.observaciones)}</div>` : ""}`,
    cfg.ancho_ticket
  );
}
