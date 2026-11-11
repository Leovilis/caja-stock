import localFont from "next/font/local";

// Fuentes y colores de la página de presentación, compartidos con las guías
export const display = localFont({
  src: [
    { path: "./fuentes/bricolage-grotesque-latin-400-normal.woff2", weight: "400" },
    { path: "./fuentes/bricolage-grotesque-latin-600-normal.woff2", weight: "600" },
    { path: "./fuentes/bricolage-grotesque-latin-800-normal.woff2", weight: "800" },
  ],
  variable: "--f-display",
  display: "swap",
});
export const mono = localFont({
  src: [
    { path: "./fuentes/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fuentes/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--f-mono",
  display: "swap",
});

/* Paleta: papel, tinta, naranja, amarillo cenefa */
export const C = { papel: "#F6F1E7", tinta: "#16130F", naranja: "#FF5B1F", cenefa: "#FFD43B" };
