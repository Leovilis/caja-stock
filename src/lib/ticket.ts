import QRCode from "qrcode";
import type { Config, Venta, Caja, Comprobante } from "./types";
import { condicionLabel, nombreCbte, numeroCbte, TIPOS_DOC, urlQR } from "./arca/calculo";
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
  const pagos = v.pagos.map((p) => `<tr><td>${escapeHtml(p.nombre ?? medioLabel(p.medio))}</td><td class="r">${money(p.monto)}</td></tr>`).join("");
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
      ${v.descuento || v.recargo ? `<tr><td>Subtotal</td><td class="r">${money(v.subtotal)}</td></tr>` : ""}
      ${v.descuento ? `<tr><td>Descuento</td><td class="r">-${money(v.descuento)}</td></tr>` : ""}
      ${v.recargo ? `<tr><td>${Number(v.recargo) > 0 ? "Recargo" : "Desc."} medio de pago</td><td class="r">${Number(v.recargo) > 0 ? "" : "-"}${money(Math.abs(Number(v.recargo)))}</td></tr>` : ""}
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

/** Factura / nota de crédito electrónica con CAE y QR (RG 4892) */
export async function imprimirComprobante(v: Venta, c: Comprobante, cfg: Config, asociado?: Comprobante | null) {
  const qr = await QRCode.toDataURL(
    urlQR({
      fecha: c.fecha,
      cuit: c.emisor_cuit,
      ptoVta: c.punto_venta,
      tipoCmp: c.tipo,
      nroCmp: Number(c.numero),
      importe: Number(c.imp_total),
      tipoDocRec: c.doc_tipo,
      nroDocRec: Number(c.doc_nro),
      cae: c.cae,
    }),
    { margin: 0, width: 260, errorCorrectionLevel: "M" }
  );
  const fechaAr = (iso: string) => iso.split("-").reverse().join("/");
  const esA = c.letra === "A";
  const docLabel = TIPOS_DOC.find((t) => t.id === c.doc_tipo)?.label.split(" ")[0] ?? "Doc";
  const cuitFmt = (x: string) => x.replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3");

  // En la A los precios se muestran sin IVA
  const filas = v.venta_items
    .map((i) => {
      const div = esA ? 1 + Number(i.alicuota_iva ?? 21) / 100 : 1;
      const pu = Number(i.precio) / div;
      const st = Number(i.subtotal) / div;
      return `<tr><td colspan="2">${escapeHtml(i.nombre)}${esA ? ` <small>(IVA ${String(i.alicuota_iva ?? 21).replace(".", ",")}%)</small>` : ""}</td></tr>
      <tr><td>&nbsp;${number(i.cantidad)} x ${money(pu)}</td><td class="r">${money(st)}</td></tr>`;
    })
    .join("");
  const sumaItems = v.venta_items.reduce((a, i) => a + Number(i.subtotal) / (esA ? 1 + Number(i.alicuota_iva ?? 21) / 100 : 1), 0);
  const descuento = Math.round(((esA ? sumaItems - Number(c.imp_neto) : Number(v.subtotal) - Number(c.imp_total)) || 0) * 100) / 100;

  const totales = esA
    ? `${descuento > 0.009 ? `<tr><td>Descuento</td><td class="r">-${money(descuento)}</td></tr>` : ""}
       <tr><td>Neto gravado</td><td class="r">${money(c.imp_neto)}</td></tr>
       ${c.iva.map((a) => `<tr><td>IVA ${String(a.alicuota).replace(".", ",")}%</td><td class="r">${money(a.importe)}</td></tr>`).join("")}
       <tr class="b big"><td>TOTAL</td><td class="r">${money(c.imp_total)}</td></tr>`
    : `${descuento > 0.009 ? `<tr><td>Subtotal</td><td class="r">${money(v.subtotal)}</td></tr><tr><td>Descuento</td><td class="r">-${money(descuento)}</td></tr>` : ""}
       <tr class="b big"><td>TOTAL</td><td class="r">${money(c.imp_total)}</td></tr>`;
  const transparencia =
    c.letra === "B"
      ? `<hr/><div style="font-size:.85em">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</div>
         <table style="font-size:.85em"><tr><td>IVA contenido</td><td class="r">${money(c.imp_iva)}</td></tr></table>`
      : "";

  imprimirHTML(
    `<div class="c b big">${escapeHtml(cfg.fiscal_razon_social || cfg.nombre)}</div>
    ${cfg.fiscal_razon_social && cfg.nombre !== cfg.fiscal_razon_social ? `<div class="c">${escapeHtml(cfg.nombre)}</div>` : ""}
    <div class="c">${escapeHtml(cfg.fiscal_domicilio || cfg.direccion)}</div>
    <div class="c">CUIT: ${cuitFmt(c.emisor_cuit)}</div>
    ${cfg.fiscal_iibb ? `<div class="c">IIBB: ${escapeHtml(cfg.fiscal_iibb)}</div>` : ""}
    ${cfg.fiscal_inicio_actividades ? `<div class="c">Inicio de actividades: ${fechaAr(cfg.fiscal_inicio_actividades)}</div>` : ""}
    <div class="c">${cfg.fiscal_condicion === "monotributo" ? "Responsable Monotributo" : "IVA Responsable Inscripto"}</div>
    <hr/>
    <div class="c b big">${nombreCbte(c.clase, c.letra)}</div>
    <div class="c">Cód. ${String(c.tipo).padStart(3, "0")}</div>
    <div class="c b">N° ${numeroCbte(c.punto_venta, Number(c.numero))}</div>
    <div class="c">Fecha: ${fechaAr(c.fecha)}</div>
    ${c.ambiente === "homologacion" ? '<div class="c b">*** PRUEBA (HOMOLOGACIÓN) — SIN VALIDEZ FISCAL ***</div>' : ""}
    <hr/>
    <div>${c.doc_tipo === 99 ? "A CONSUMIDOR FINAL" : `${escapeHtml(c.receptor_nombre || "Cliente")}`}</div>
    ${c.doc_tipo !== 99 ? `<div>${docLabel}: ${c.doc_tipo === 80 || c.doc_tipo === 86 ? cuitFmt(String(c.doc_nro)) : c.doc_nro}</div>` : ""}
    <div>Cond. IVA: ${condicionLabel(c.receptor_condicion)}</div>
    ${c.receptor_domicilio ? `<div>Domicilio: ${escapeHtml(c.receptor_domicilio)}</div>` : ""}
    ${asociado ? `<div>Comprobante asociado: ${nombreCbte(asociado.clase, asociado.letra)} ${numeroCbte(asociado.punto_venta, Number(asociado.numero))}</div>` : ""}
    <hr/>
    <table>${filas}</table>
    <hr/>
    <table>${totales}</table>
    ${transparencia}
    <hr/>
    <table><tr><td>CAE N°</td><td class="r b">${c.cae}</td></tr><tr><td>Vto. CAE</td><td class="r">${fechaAr(c.cae_vto)}</td></tr></table>
    <div class="c" style="margin-top:6px"><img src="${qr}" style="width:32mm;height:32mm"/></div>
    <div class="c" style="font-size:.85em">Comprobante autorizado por ARCA</div>
    <div class="c" style="font-size:.85em">Ticket interno N° ${v.numero}</div>`,
    cfg.ancho_ticket
  );
}
