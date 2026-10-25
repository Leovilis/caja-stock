// Cliente de los web services de ARCA (WSAA + WSFEv1). SÓLO SERVIDOR.
import "server-only";
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";

export type Ambiente = "homologacion" | "produccion";

const URLS = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
};

// Permite apuntar a un simulador en pruebas (nunca configurar en producción)
const urlWsaa = (a: Ambiente) => process.env.ARCA_WSAA_URL || URLS[a].wsaa;
const urlWsfe = (a: Ambiente) => process.env.ARCA_WSFE_URL || URLS[a].wsfe;

const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });

export class ArcaError extends Error {
  constructor(
    msg: string,
    public detalle?: unknown
  ) {
    super(msg);
  }
}

/* ------------------------------------------------------------------ */
/* Certificado                                                         */
/* ------------------------------------------------------------------ */
/** Certificado y clave privada en PEM (de Supabase Vault, por comercio) */
export interface CredencialesPem {
  cert: string;
  key: string;
}

/** Acepta PEM directo, PEM con "\n" escapados (variables de Vercel) o base64 del PEM */
export function leerPem(valor: string | undefined, nombre: string): string {
  if (!valor) throw new ArcaError(`Falta cargar: ${nombre.toLowerCase()}`);
  let v = valor.trim().replace(/\\n/g, "\n");
  if (!v.includes("-----BEGIN")) v = Buffer.from(v, "base64").toString("utf8");
  if (!v.includes("-----BEGIN")) throw new ArcaError(`${nombre} no tiene un formato PEM válido`);
  return v;
}

export function credenciales(pem: CredencialesPem) {
  let cert: forge.pki.Certificate;
  let key: forge.pki.rsa.PrivateKey;
  try {
    cert = forge.pki.certificateFromPem(leerPem(pem.cert, "El certificado"));
  } catch (e) {
    throw e instanceof ArcaError ? e : new ArcaError("El certificado no es válido (tiene que ser el .crt/.pem que descargaste de ARCA)");
  }
  try {
    key = forge.pki.privateKeyFromPem(leerPem(pem.key, "La clave privada")) as forge.pki.rsa.PrivateKey;
  } catch (e) {
    throw e instanceof ArcaError ? e : new ArcaError("La clave privada no es válida (tiene que ser el .key con el que generaste el pedido, sin contraseña)");
  }
  return { cert, key };
}

/** CUIT que figura en el certificado ("CUIT 20123456789" en el serialNumber del sujeto) */
export function cuitDeCertificado(cert: forge.pki.Certificate) {
  const serial = String(cert.subject.attributes.find((a) => a.type === "2.5.4.5")?.value ?? "");
  return serial.replace(/\D/g, "");
}

export function infoCertificado(pem: CredencialesPem) {
  const { cert, key } = credenciales(pem);
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  const corresponde = pub.n.equals(key.n) && pub.e.equals(key.e);
  const cn = cert.subject.getField("CN")?.value ?? "";
  const serial = cert.subject.attributes.find((a) => a.type === "2.5.4.5")?.value ?? "";
  return { cn, serialNumber: serial, cuit: cuitDeCertificado(cert), vence: cert.validity.notAfter.toISOString(), corresponde };
}

/* ------------------------------------------------------------------ */
/* WSAA — ticket de acceso                                             */
/* ------------------------------------------------------------------ */
/** TRA firmado en CMS (PKCS#7 SignedData con contenido incluido), en base64 */
export function firmarTRA(servicio: string, pem: CredencialesPem, ahora = new Date()): string {
  const { cert, key } = credenciales(pem);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const tra =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${fmt(new Date(ahora.getTime() - 5 * 60_000))}</generationTime>` +
    `<expirationTime>${fmt(new Date(ahora.getTime() + 5 * 60_000))}</expirationTime>` +
    `</header><service>${servicio}</service></loginTicketRequest>`;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: ahora as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function soap(url: string, accion: string, cuerpo: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: accion },
      body: cuerpo,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ArcaError("No se pudo conectar con ARCA. Probá de nuevo en unos minutos.", String(e));
  }
  const texto = await res.text();
  const doc = parser.parse(texto) as Record<string, unknown>;
  const body = (doc.Envelope as Record<string, unknown> | undefined)?.Body as Record<string, unknown> | undefined;
  if (!body) throw new ArcaError(`Respuesta inesperada de ARCA (HTTP ${res.status})`, texto.slice(0, 500));
  const fault = body.Fault as Record<string, unknown> | undefined;
  if (fault) throw new ArcaError(`ARCA: ${String(fault.faultstring ?? "error")}`, fault);
  return body;
}

export interface TA {
  token: string;
  sign: string;
  expira: Date;
}

/** Pide un TA nuevo a WSAA (usar con caché: ARCA rechaza pedidos repetidos mientras haya uno vigente) */
export async function loginWSAA(ambiente: Ambiente, pem: CredencialesPem, servicio = "wsfe"): Promise<TA> {
  const cms = firmarTRA(servicio, pem);
  const body = await soap(
    urlWsaa(ambiente),
    "",
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
      `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`
  ).catch((e: ArcaError) => {
    if (/ya posee un TA valido/i.test(e.message))
      throw new ArcaError(
        "ARCA dice que ya hay un ticket de acceso vigente que este sistema no tiene guardado. Se libera solo en hasta 12 horas; mientras tanto no se puede facturar desde aquí.",
        e.detalle
      );
    if (/cms|certificado|firma/i.test(e.message))
      throw new ArcaError("ARCA rechazó el certificado: revisá que sea del ambiente correcto y que esté asociado al servicio wsfe.", e.message);
    throw e;
  });
  const ret = (body.loginCmsResponse as Record<string, unknown>)?.loginCmsReturn as string;
  if (!ret) throw new ArcaError("WSAA no devolvió el ticket de acceso");
  const ta = parser.parse(ret) as { loginTicketResponse?: { header?: { expirationTime?: string }; credentials?: { token?: string; sign?: string } } };
  const cred = ta.loginTicketResponse?.credentials;
  if (!cred?.token || !cred.sign) throw new ArcaError("Ticket de acceso inválido");
  return { token: cred.token, sign: cred.sign, expira: new Date(ta.loginTicketResponse!.header!.expirationTime!) };
}

/* ------------------------------------------------------------------ */
/* WSFEv1                                                              */
/* ------------------------------------------------------------------ */
const NS = "http://ar.gov.afip.dif.FEV1/";

function sobre(metodo: string, interior: string) {
  return (
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS}">` +
    `<soap:Body><ar:${metodo}>${interior}</ar:${metodo}></soap:Body></soap:Envelope>`
  );
}
const auth = (ta: TA, cuit: string) =>
  `<ar:Auth><ar:Token>${xmlEsc(ta.token)}</ar:Token><ar:Sign>${xmlEsc(ta.sign)}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;

type Obj = Record<string, unknown>;
const lista = <T>(x: T | T[] | undefined): T[] => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);

function erroresWsfe(res: Obj): string[] {
  const errs = lista((res.Errors as Obj | undefined)?.Err as Obj | Obj[]);
  return errs.map((e) => `${e.Code}: ${e.Msg}`);
}

export async function feDummy(ambiente: Ambiente) {
  const body = await soap(urlWsfe(ambiente), NS + "FEDummy", sobre("FEDummy", ""));
  const r = (body.FEDummyResponse as Obj)?.FEDummyResult as Obj;
  return { app: String(r?.AppServer ?? ""), db: String(r?.DbServer ?? ""), auth: String(r?.AuthServer ?? "") };
}

export async function ultimoAutorizado(ambiente: Ambiente, ta: TA, cuit: string, ptoVta: number, tipo: number): Promise<number> {
  const body = await soap(
    urlWsfe(ambiente),
    NS + "FECompUltimoAutorizado",
    sobre("FECompUltimoAutorizado", `${auth(ta, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`)
  );
  const r = (body.FECompUltimoAutorizadoResponse as Obj)?.FECompUltimoAutorizadoResult as Obj;
  const errs = erroresWsfe(r ?? {});
  if (errs.length) throw new ArcaError("ARCA: " + errs.join(" | "));
  return Number(r?.CbteNro ?? 0);
}

export interface SolicitudCAE {
  ptoVta: number;
  tipo: number;
  numero: number;
  fecha: string; // yyyymmdd
  docTipo: number;
  docNro: number;
  condicionReceptor: number;
  impTotal: number;
  impNeto: number;
  impIva: number;
  iva: { id: number; base: number; importe: number }[];
  asociado?: { tipo: number; ptoVta: number; numero: number; cuit: string; fecha: string };
}

export interface RespuestaCAE {
  aprobado: boolean;
  cae?: string;
  caeVto?: string; // yyyymmdd
  observaciones: string[];
  errores: string[];
}

const f2 = (n: number) => n.toFixed(2);

export function xmlSolicitudCAE(ta: TA, cuit: string, s: SolicitudCAE) {
  // El orden de los elementos respeta el esquema de WSFEv1 (secuencia estricta)
  const det =
    `<ar:Concepto>1</ar:Concepto>` +
    `<ar:DocTipo>${s.docTipo}</ar:DocTipo><ar:DocNro>${s.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${s.numero}</ar:CbteDesde><ar:CbteHasta>${s.numero}</ar:CbteHasta><ar:CbteFch>${s.fecha}</ar:CbteFch>` +
    `<ar:ImpTotal>${f2(s.impTotal)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${f2(s.impNeto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>${f2(s.impIva)}</ar:ImpIVA>` +
    `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${s.condicionReceptor}</ar:CondicionIVAReceptorId>` +
    (s.asociado
      ? `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${s.asociado.tipo}</ar:Tipo><ar:PtoVta>${s.asociado.ptoVta}</ar:PtoVta>` +
        `<ar:Nro>${s.asociado.numero}</ar:Nro><ar:Cuit>${s.asociado.cuit}</ar:Cuit><ar:CbteFch>${s.asociado.fecha}</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>`
      : "") +
    (s.iva.length
      ? `<ar:Iva>${s.iva
          .map((a) => `<ar:AlicIva><ar:Id>${a.id}</ar:Id><ar:BaseImp>${f2(a.base)}</ar:BaseImp><ar:Importe>${f2(a.importe)}</ar:Importe></ar:AlicIva>`)
          .join("")}</ar:Iva>`
      : "");
  return sobre(
    "FECAESolicitar",
    `${auth(ta, cuit)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${s.ptoVta}</ar:PtoVta>` +
      `<ar:CbteTipo>${s.tipo}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${det}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`
  );
}

export async function solicitarCAE(ambiente: Ambiente, ta: TA, cuit: string, s: SolicitudCAE): Promise<RespuestaCAE> {
  const body = await soap(urlWsfe(ambiente), NS + "FECAESolicitar", xmlSolicitudCAE(ta, cuit, s));
  const r = (body.FECAESolicitarResponse as Obj)?.FECAESolicitarResult as Obj;
  if (!r) throw new ArcaError("ARCA no devolvió resultado");
  const det = lista(((r.FeDetResp as Obj | undefined)?.FECAEDetResponse as Obj | Obj[]))[0] ?? {};
  const obs = lista(((det.Observaciones as Obj | undefined)?.Obs as Obj | Obj[])).map((o) => `${o.Code}: ${o.Msg}`);
  const errores = erroresWsfe(r);
  const aprobado = String(det.Resultado ?? (r.FeCabResp as Obj)?.Resultado) === "A" && !!det.CAE;
  return { aprobado, cae: det.CAE ? String(det.CAE) : undefined, caeVto: det.CAEFchVto ? String(det.CAEFchVto) : undefined, observaciones: obs, errores };
}
