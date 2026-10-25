# Cobro con QR de Mercado Pago (automático)

Disponible en **todos los planes** (básico y completo). Cada comercio conecta **su propia** cuenta de Mercado Pago.

## Cómo funciona

1. En la caja: **Cobrar → «Cobrar $X con QR Mercado Pago (automático)»**.
2. La app crea una **orden** en Mercado Pago por el total del ticket (API *Orders*, `type: qr`, modo *hybrid*).
3. El cliente paga escaneando:
   - el **QR que aparece en pantalla** (único para ese cobro), o
   - el **QR impreso de la caja** (cartel que se descarga en Configuración).
4. La app consulta el estado cada 2,5 s. Cuando Mercado Pago lo aprueba, **la venta se registra sola** en el medio que corresponde:
   - dinero en cuenta → *QR Mercado Pago · Dinero en cuenta*
   - débito / prepaga → *QR Mercado Pago · Débito*
   - crédito → *QR Mercado Pago · Crédito*
   (si esos medios no existen, se registra como *QR / Mercado Pago*). La comisión sale de *Configuración → Medios de cobro*.
5. Si el cliente no paga, **Cancelar cobro** (o cerrar la ventana) cancela la orden. Sin cancelar, vence sola a los 10 minutos.

**Seguridad:** la base de datos sólo acepta la venta si ese cobro figura **aprobado** en Mercado Pago, es del mismo comercio, es **por el mismo monto** y **no se usó en otra venta**. Un comprobante falso no sirve.

**Recargos:** el cobro con QR automático cobra el **total del ticket sin recargo** (no se sabe de antemano si van a pagar con débito o crédito). El QR manual sigue aplicando el recargo configurado.

## Conectar la cuenta (una vez por comercio)

Requisito del servidor: la variable **`SUPABASE_SECRET_KEY`** (Vercel → Settings → Environment Variables, o `.env.local`). Sin ella, conectar y cobrar dan error.

1. Con la cuenta de Mercado Pago **que cobra en el local**, entrar a [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) y **crear una aplicación** (pagos presenciales / código QR).
2. En la aplicación: **Credenciales de producción → Access Token** (`APP_USR-…`).
3. En la app: **Configuración → Mercado Pago → pegar el token → Conectar**.
4. Elegir una **sucursal** existente de Mercado Pago o crear una nueva (nombre, dirección y la ubicación copiada de Google Maps).
5. La app crea la caja **«Caja y Stock»** en esa sucursal. Desde ahí se descarga el **cartel con el QR** para imprimir y pegar en el mostrador.
6. En **Medios de cobro**, agregar la plantilla **«+ QR Mercado Pago»** para que cada pago quede con su comisión.

El token se guarda **cifrado en Supabase Vault** (`mp_token_<comercio>`); el navegador nunca lo ve.

## Por dentro

- Tablas: `mp_cuentas` (cuenta, sucursal y caja de MP por comercio) y `mp_cobros` (cada orden: monto, estado, tipo de pago, venta asociada).
- Rutas: `POST/DELETE /api/mp/cuenta` (conectar / desconectar, sólo admins), `POST/GET/DELETE /api/mp/cobro` (crear, consultar, cancelar).
- `src/lib/mp/servidor.ts`: llamadas a la API (`/users/me`, `/users/{id}/stores`, `/v2/pos`, `/v1/orders`).
  `MP_API_URL` permite apuntar a un simulador en pruebas.
- `registrar_venta` valida los pagos con `mp_order` contra `mp_cobros` y los vincula a la venta.
- Estados: la orden `processed` con el pago procesado **y por el monto pedido** = aprobado; `canceled` = cancelado; `expired` = vencido; `failed/refunded` = rechazado.

## Pendiente / ideas

- **Webhook** de Mercado Pago (hoy se consulta el estado; el webhook lo haría instantáneo y serviría si se cierra la pestaña).
- **Devoluciones**: anular una venta cobrada con QR no devuelve la plata en MP; hay que hacerlo desde la app de Mercado Pago.
- **Point** (posnet de MP) con la misma API de Orders.
