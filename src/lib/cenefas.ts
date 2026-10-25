// Cenefas (etiquetas de precio para la góndola) en hoja A4, listas para recortar
import type { Config, Producto } from "./types";

export type TamanoCenefa = "chica" | "mediana" | "grande";

const TAMANOS: Record<TamanoCenefa, { columnas: number; alto: number; precio: number; nombre: number }> = {
  chica: { columnas: 4, alto: 30, precio: 22, nombre: 9 },
  mediana: { columnas: 3, alto: 38, precio: 30, nombre: 11 },
  grande: { columnas: 2, alto: 55, precio: 44, nombre: 14 },
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** $ 1.500 (sin centavos si es redondo) */
export function precioCenefa(n: number) {
  const entero = Math.round(n * 100) % 100 === 0;
  return (
    "$ " +
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2 }).format(Number(n) || 0)
  );
}

export function imprimirCenefas(
  productos: Producto[],
  cfg: Config,
  opciones: { tamano: TamanoCenefa; mostrarCodigo: boolean; mostrarFecha: boolean; mostrarComercio: boolean }
) {
  const t = TAMANOS[opciones.tamano];
  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const celdas = productos
    .map(
      (p) => `
    <div class="cen">
      <div class="nom">${esc(p.nombre)}${p.marca ? ` <span class="mar">${esc(p.marca)}</span>` : ""}</div>
      <div class="pre">${precioCenefa(p.precio)}</div>
      <div class="pie">
        <span>${opciones.mostrarCodigo && p.codigo ? esc(p.codigo) : ""}</span>
        <span>${opciones.mostrarComercio ? esc(cfg.nombre) : ""}${opciones.mostrarComercio && opciones.mostrarFecha ? " · " : ""}${opciones.mostrarFecha ? hoy : ""}</span>
      </div>
    </div>`
    )
    .join("");

  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const d = iframe.contentWindow!.document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cenefas</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .grid { display: grid; grid-template-columns: repeat(${t.columnas}, 1fr); }
  .cen { height: ${t.alto}mm; border: 1px dashed #999; padding: 2mm 2.5mm; display: flex; flex-direction: column;
         justify-content: space-between; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
  .nom { font-size: ${t.nombre}pt; font-weight: bold; line-height: 1.15; max-height: 2.4em; overflow: hidden; text-transform: uppercase; }
  .mar { font-weight: normal; font-size: 0.8em; text-transform: none; }
  .pre { font-size: ${t.precio}pt; font-weight: 900; text-align: right; letter-spacing: -0.5px; line-height: 1; }
  .pie { display: flex; justify-content: space-between; font-size: 6.5pt; color: #444; font-family: "Courier New", monospace; }
</style></head><body><div class="grid">${celdas}</div></body></html>`);
  d.close();
  setTimeout(() => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
}
