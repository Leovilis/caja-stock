"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, X } from "lucide-react";

/** Resultado que muestra el escáner después de cada lectura */
export interface Lectura {
  ok: boolean;
  texto: string;
}

/** Variantes de un código leído: UPC-A (12) ↔ EAN-13 con 0 adelante, sin ceros a la izquierda */
export function variantesCodigo(c: string): string[] {
  const v = new Set([c]);
  if (/^\d{12}$/.test(c)) v.add("0" + c);
  if (/^0\d{12}$/.test(c)) v.add(c.slice(1));
  return [...v];
}

/** Botón con ícono de cámara (mismo alto que los inputs) */
export function BotonCamara({ onClick, className = "", texto }: { onClick: () => void; className?: string; texto?: string }) {
  return (
    <button type="button" className={`btn-ghost ${className}`} onClick={onClick} title="Escanear con la cámara">
      <Camera size={16} /> {texto && <span className="hidden sm:inline">{texto}</span>}
    </button>
  );
}

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

/**
 * Lector de códigos de barras con la cámara del celular, tablet o PC.
 * Usa el detector del navegador (Chrome/Android) y, si no está (iPhone/Safari, Firefox), la librería ZXing.
 * - continuo: queda abierto para escanear varios seguidos (punto de venta, compras).
 * - si no, se cierra con la primera lectura (cargar el código de un producto).
 */
export function EscanerCamara({
  open,
  onClose,
  onCodigo,
  continuo = false,
  titulo = "Escaneá el código de barras",
}: {
  open: boolean;
  onClose: () => void;
  onCodigo: (codigo: string) => Lectura | void;
  continuo?: boolean;
  titulo?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ultima, setUltima] = useState<Lectura | null>(null);
  const [linterna, setLinterna] = useState<boolean | null>(null); // null = el equipo no tiene
  const pista = useRef<MediaStreamTrack | null>(null);
  // callback siempre actualizado (el carrito cambia en cada lectura)
  const cb = useRef(onCodigo);
  cb.current = onCodigo;
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    let stream: MediaStream | null = null;
    let detenerZxing: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // código → última vez que se vio. Mientras el mismo código siga frente a la cámara no se vuelve a contar:
    // para sumar otra unidad igual hay que sacarlo del recuadro y volver a mostrarlo.
    const vistos = new Map<string, number>();
    setError("");
    setUltima(null);
    setLinterna(null);

    const leido = (codigo: string) => {
      const ahora = Date.now();
      const antes = vistos.get(codigo) ?? 0;
      vistos.set(codigo, ahora);
      if (ahora - antes < 1200) return;
      const r = cb.current(codigo) || { ok: true, texto: codigo };
      setUltima(r);
      pitido(r.ok);
      try {
        navigator.vibrate?.(r.ok ? 60 : [40, 60, 40]);
      } catch {
        /* sin vibración */
      }
      if (!continuo && r.ok) setTimeout(() => cerrar.current(), 250);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Abrí la app con https en Chrome o Safari.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        const n = (e as DOMException).name;
        setError(
          n === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones y volvé a intentar."
            : n === "NotFoundError"
              ? "No se encontró ninguna cámara en este equipo."
              : "No se pudo abrir la cámara (puede estar en uso por otra app)."
        );
        return;
      }
      if (!vivo || !video.current) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      await v.play().catch(() => {});
      pista.current = stream.getVideoTracks()[0] ?? null;
      const cap = (pista.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      if (cap.torch) setLinterna(false);

      // 1) detector del navegador
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      let nativos: string[] = [];
      if (BD) {
        try {
          const soportados = (await BD.getSupportedFormats?.()) ?? [];
          nativos = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));
        } catch {
          nativos = [];
        }
      }
      if (BD && nativos.length) {
        const det = new BD({ formats: nativos });
        const ciclo = async () => {
          if (!vivo) return;
          try {
            if (v.readyState >= 2) {
              const r = await det.detect(v);
              if (r[0]?.rawValue) leido(r[0].rawValue.trim());
            }
          } catch {
            /* cuadro ilegible: sigue */
          }
          timer = setTimeout(ciclo, 120);
        };
        ciclo();
        return;
      }

      // 2) ZXing (iPhone, Firefox, PCs sin detector)
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ]);
        const lector = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        if (!vivo) return;
        const ctrl = await lector.decodeFromVideoElement(v, (res) => {
          if (res && vivo) leido(res.getText().trim());
        });
        detenerZxing = () => ctrl.stop();
      } catch {
        setError("No se pudo iniciar el lector de códigos en este navegador.");
      }
    })();

    return () => {
      vivo = false;
      clearTimeout(timer);
      detenerZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      pista.current = null;
    };
  }, [open, continuo]);

  async function alternarLinterna() {
    const t = pista.current;
    if (!t || linterna === null) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] });
      setLinterna(!linterna);
    } catch {
      setLinterna(null);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="font-semibold">{titulo}</div>
        <div className="flex items-center gap-2">
          {linterna !== null && (
            <button className={`rounded-full p-2 ${linterna ? "bg-amber-400 text-black" : "bg-white/10"}`} onClick={alternarLinterna} title="Linterna">
              <Flashlight size={20} />
            </button>
          )}
          <button className="rounded-full bg-white/10 p-2" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-36 w-[80%] max-w-md rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-rose-500" />
            </div>
          </div>
        )}
        {error && <div className="absolute inset-x-6 rounded-xl bg-rose-600 p-4 text-center text-sm">{error}</div>}
      </div>

      <div className="px-4 pb-6 pt-3 text-center">
        {ultima ? (
          <div className={`mx-auto max-w-md rounded-xl px-4 py-3 font-semibold ${ultima.ok ? "bg-emerald-600" : "bg-rose-600"}`}>{ultima.texto}</div>
        ) : (
          <div className="text-sm text-white/70">Poné el código dentro del recuadro, sin moverlo, con buena luz. Para sumar otro igual, sacalo y volvé a mostrarlo.</div>
        )}
        {continuo && (
          <button className="btn-primary mx-auto mt-3 w-full max-w-md justify-center" onClick={onClose}>
            Listo
          </button>
        )}
      </div>
    </div>
  );
}

/** Pitido corto (más grave si el producto no se encontró) */
function pitido(ok: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1650 : 320;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.09 : 0.25));
    o.onended = () => ctx.close();
  } catch {
    /* sin audio */
  }
}
