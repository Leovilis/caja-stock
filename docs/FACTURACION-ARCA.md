# Facturación electrónica ARCA — puesta en marcha

El sistema emite **Factura A, B y C** y sus **Notas de Crédito** conectándose directo a los web services
oficiales de ARCA (WSAA + WSFEv1), sin intermediarios ni costo por comprobante.

- **Monotributo** → Factura C / Nota de Crédito C.
- **Responsable Inscripto** → Factura A (a otro Responsable Inscripto, con CUIT) o B (al resto), con IVA por alícuota.
- Se factura **a pedido**: desde *Ventas → detalle → Facturar (ARCA)* o con el botón *Facturar* que aparece en la caja después de cobrar.
- Anular una venta facturada emite automáticamente la **Nota de Crédito** antes de anularla.
- El comprobante impreso incluye CAE, vencimiento y el **código QR** obligatorio (RG 4892). En la B se informa el **IVA contenido** (Ley 27.743).
- Se envía siempre la **condición frente al IVA del receptor** (RG 5616).

> Primero probá todo en **homologación** (ambiente de pruebas de ARCA, sin validez fiscal) y recién después pasá a **producción**.
> Consultá con tu contador qué comprobantes te corresponde emitir.

---

## 1. Actualizar la base

Volvé a ejecutar `supabase/schema.sql` completo en el SQL Editor de Supabase (se puede correr sobre una base con datos:
agrega columnas y tablas nuevas sin borrar nada).

## 2. Generar la clave privada y el pedido de certificado

En una terminal con OpenSSL (Linux/Mac, o Git Bash en Windows). Reemplazá el CUIT y el nombre:

```bash
openssl genrsa -out cajastock.key 2048
openssl req -new -key cajastock.key -out cajastock.csr \
  -subj "/C=AR/O=Tu Nombre o Razon Social/CN=cajastock/serialNumber=CUIT 20123456789"
```

`cajastock.key` es **secreta**: no la compartas ni la subas a GitHub.

## 3a. Certificado de HOMOLOGACIÓN (pruebas)

1. Entrá a ARCA con clave fiscal → *Administrador de Relaciones de Clave Fiscal* → **Adherir servicio** →
   *WSASS – Autogestión Certificados Homologación*.
2. Entrá a **WSASS** → *Nuevo Certificado*: poné un nombre (ej. `cajastock`), pegá el contenido de `cajastock.csr` y descargá el certificado (`cajastock.crt`).
3. En WSASS → *Crear autorización a servicio*: elegí el certificado y el servicio **wsfe** (Facturación Electrónica).
4. En homologación cualquier número de punto de venta funciona (ej. 1).

## 3b. Certificado de PRODUCCIÓN (facturas reales)

1. ARCA → **Administración de Certificados Digitales** → *Agregar alias* (ej. `cajastock`) → subí `cajastock.csr` → descargá el certificado.
   *(Es un certificado distinto del de homologación; la clave privada puede ser la misma.)*
2. ARCA → **Administrador de Relaciones de Clave Fiscal** → *Nueva Relación* → servicio
   *ARCA → WebServices → Facturación Electrónica* → representante: el certificado/computador fiscal del paso anterior → confirmar.
3. ARCA → **Administración de puntos de venta y domicilios** → *Agregar* un punto de venta nuevo con el sistema
   *"Factura Electrónica – Monotributo – Web Services"* (monotributo) o *"RECE para aplicativo y web services"* (responsable inscripto).
   Anotá el número: es el que va en Configuración. **No uses el mismo punto de venta que el facturador en línea.**

## 4. Clave del servidor y certificado de cada comercio

**Una sola vez, en el servidor** (Vercel → Project → Settings → Environment Variables, o `.env.local`):

| Variable | Valor |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_...`). **Nunca** con prefijo `NEXT_PUBLIC_`. |

Después de cargarla en Vercel, hacé un **Redeploy**.

**El certificado lo carga cada comercio** en la app: **Configuración → Facturación electrónica → Certificado digital**,
eligiendo `cajastock.crt` y `cajastock.key`. Se guarda **cifrado en Supabase Vault**: ni el navegador ni los demás
comercios pueden leerlo, sólo el servidor al facturar. La app verifica que la clave corresponda al certificado y que no esté vencido.

> Compatibilidad: si el servidor tiene `ARCA_CERT` / `ARCA_KEY` (instalación anterior de un solo comercio), se usan
> **sólo** para el comercio cuyo CUIT coincide con el del certificado y que todavía no cargó uno propio.

## 5. Configurar y probar

1. En la app: **Configuración → Facturación electrónica (ARCA)**: condición (Monotributo / Responsable Inscripto), CUIT,
   razón social, domicilio comercial, Ingresos Brutos, inicio de actividades, punto de venta y ambiente.
2. Tocá **Guardar y probar conexión con ARCA**. Tienen que quedar en verde los cinco pasos:
   datos fiscales, certificado, servidores de ARCA, autenticación y numeración del punto de venta.
3. Si sos Responsable Inscripto, revisá la **alícuota de IVA** de cada producto (por defecto 21 %). Los precios siguen siendo finales (IVA incluido).
4. Hacé ventas de prueba y facturalas. Probá también anular una facturada (emite la nota de crédito).
5. Cuando todo funcione: cargá el certificado de producción en **Configuración → Certificado digital**, cambiá el ambiente a **Producción** y el punto de venta al de producción.

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| *Falta SUPABASE_SECRET_KEY* | Cargala en Vercel y hacé redeploy. |
| *Falta el certificado digital* | Cargalo en Configuración → Facturación electrónica → Certificado digital. |
| *La facturación no está incluida en el plan básico* | El administrador general tiene que pasar el comercio a plan completo. |
| *ARCA rechazó el certificado* | Certificado de otro ambiente, vencido, o sin autorización al servicio **wsfe**. |
| *Ya hay un ticket de acceso vigente…* | Pasa si se borró la tabla `arca_ta` o se usó el mismo certificado desde otro sistema. Se libera solo en hasta 12 h. Lo ideal es usar un certificado exclusivo para este sistema. |
| *10016: número de comprobante* | El sistema reintenta solo. Si persiste, otro sistema está usando el mismo punto de venta. |
| *Condición IVA receptor…* | Elegí bien la condición del cliente; la factura A sólo es para Responsables Inscriptos con CUIT. |
| ARCA pide identificar al consumidor final | Por encima del monto que fija ARCA hay que cargar DNI/CUIT del cliente. |
| *El comprobante fue AUTORIZADO por ARCA pero no se pudo guardar* | El comprobante existe en ARCA: anotá tipo, punto de venta, número y CAE que muestra el mensaje y avisá al técnico. |

## Cómo funciona por dentro

- `src/lib/arca/servicio.ts`: firma el TRA en CMS/PKCS#7 (SHA-256) con el certificado, pide el ticket a **WSAA** y llama a
  **WSFEv1** (`FEDummy`, `FECompUltimoAutorizado`, `FECAESolicitar`).
- `src/lib/arca/servidor.ts`: valida usuario y datos, calcula importes, numera (último autorizado + 1, con reintento),
  pide el CAE y guarda el comprobante. El ticket de acceso (vale ~12 h) se guarda en la tabla `arca_ta`, invisible para el navegador.
- `src/lib/arca/calculo.ts`: letra, IVA por alícuota (prorrateando descuentos, cuadra al centavo), validación de CUIT y QR.
- Rutas: `POST /api/arca/facturar`, `POST /api/arca/anular`, `GET /api/arca/estado`, `GET/POST /api/arca/certificado`. Corren en el servidor (región São Paulo en Vercel).
- Multi-comercio: las rutas usan la clave secreta (sin RLS), así que **toda** consulta filtra por el `comercio_id` del usuario que llama;
  el certificado de cada comercio se lee de Vault con `arca_credenciales()` (sólo `service_role`).
- Una venta no se puede facturar dos veces (marca de "facturando" + índice único) y la base no deja anular una venta facturada sin su nota de crédito.
