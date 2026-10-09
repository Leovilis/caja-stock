/** Exportación / importación CSV simple (separador ; compatible con Excel en es-AR) */

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function descargarCSV(nombre: string, filas: Record<string, unknown>[], columnas?: string[]) {
  const cols = columnas ?? (filas[0] ? Object.keys(filas[0]) : []);
  const lineas = [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(f[c])).join(";"))];
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre.endsWith(".csv") ? nombre : `${nombre}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseCSV(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [head, ...rest] = filas.filter((f) => f.some((x) => x.trim() !== ""));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** "1.234,50" | "1234.50" | "$ 1.234" -> 1234.5 */
export function parseNumero(s: string | undefined): number {
  if (!s) return 0;
  let v = s.replace(/[^\d,.-]/g, "");
  if (v.includes(",") && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
  else if (v.includes(",")) v = v.replace(",", ".");
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
