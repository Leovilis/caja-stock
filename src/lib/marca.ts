// Marca y dominios (un solo lugar para cambiarlos)
export const MARCA = {
  nombre: "Mostrador",
  dominio: "mikiosko.com.ar",
  urlApp: "https://app.mikiosko.com.ar",
  /** WhatsApp de contacto, sólo números con código de país (ej: 5493884123456). Se configura en Vercel. */
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO ?? "").replace(/\D/g, ""),
};

/** Link de WhatsApp con mensaje armado (si no hay número configurado, lleva a la app) */
export const linkWhatsApp = (mensaje: string) =>
  MARCA.whatsapp ? `https://wa.me/${MARCA.whatsapp}?text=${encodeURIComponent(mensaje)}` : "#probar";
