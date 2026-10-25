# Caja & Stock — Drugstore de bebidas y snacks

Webapp de punto de venta para kiosco/drugstore: **ventas en tiempo real con lector de código de barras, caja con arqueo, stock, compras a proveedores, gastos y reportes de rentabilidad**.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind · **Supabase** (PostgreSQL + Auth + Realtime) · Recharts.

## Módulos

| Módulo | Qué hace | Quién |
|---|---|---|
| **Punto de venta** (`/pos`) | Escaneo de código (también `6*código` para cantidad), búsqueda por nombre, favoritos, ítem "Varios" sin código, descuento % o $, cobro con efectivo/débito/crédito/transferencia/QR, **pago dividido**, vuelto con billetes rápidos, ticket térmico 58/80 mm. Atajos: F2 buscar · F4 varios · F8 descuento · F12 cobrar. El carrito sobrevive a un F5. | Todos |
| **Caja** (`/caja`) | Apertura con fondo inicial, ingresos/retiros de efectivo, pagos desde caja (opcionalmente como gasto), resumen en vivo por medio de pago, **cierre con conteo de billetes**, faltante/sobrante, impresión del cierre e historial. | Todos (historial: admin) |
| **Ventas** (`/ventas`) | Historial por fechas, detalle, reimpresión, **anulación con devolución de stock**, exportación CSV. | Vendedor: sólo hoy |
| **Productos** | ABM con costo → margen → precio (redondeo a $10), código interno para productos sin EAN, favoritos, **aumento masivo de precios por %** (por categoría, con redondeo), **cenefas** para la góndola en A4 (todas, por categoría, favoritos o sólo los precios cambiados desde una fecha), importar/exportar CSV, stock valorizado. | Admin edita, vendedor consulta |
| **Stock** | **Vencimientos** (cargados al ingresar mercadería o a mano; aviso N días antes, contador en el menú y en Inicio; "se vendió" o "retirar" que descuenta como vencido), lista de reposición por proveedor con cantidad sugerida (exportable como pedido), ajustes por inventario/rotura/vencido, historial de movimientos, pérdidas del período. | Admin |
| **Compras** | Ingreso de mercadería: suma stock, actualiza costo y opcionalmente **mantiene el margen** ajustando el precio; pago desde caja o a cuenta corriente. Se indica si vino **con factura (A/B/C) o sin factura**, con número e IVA; se puede completar después. | Admin |
| **Proveedores** | Contacto, WhatsApp directo, días de visita, productos asociados. | Admin |
| **Gastos** | Gastos operativos por categoría (alquiler, luz, sueldos, impuestos, comisiones MP…), CSV. | Admin |
| **Reportes** | Ventas, costo, **ganancia bruta, margen, gastos y resultado neto**, evolución diaria, medios de pago, día de semana, franja horaria, por categoría, por vendedor, ranking de productos. | Admin |
| **Inicio** | Ventas y ganancia de hoy vs ayer, resultado del mes, últimos 14 días, ventas por hora, más vendidos, alertas de stock. | Admin |
| **Libro consolidado** (`/libro`) | Ventas y compras del período en un solo lugar, con filtro **Ambas / Con factura / Sin factura** (también en Ventas, Compras y Reportes): totales, ventas − compras, comparación con vs. sin factura, resumen por mes, IVA débito/crédito estimado (Resp. Inscripto) y CSV. | Admin |
| **Facturación electrónica ARCA** | Factura A, B y C y notas de crédito por web service directo (WSAA + WSFEv1), a pedido desde Ventas o la caja, con CAE, QR, IVA por alícuota y RG 5616. Ver [`docs/FACTURACION-ARCA.md`](docs/FACTURACION-ARCA.md). | Todos facturan; NC sólo admin |
| **Usuarios / Configuración** | Roles admin/vendedor, alta sin cerrar tu sesión, desactivar, reset de contraseña. Datos del ticket, ancho de impresora, impresión automática, stock negativo, categorías. | Admin |

## Puesta en marcha

1. **Supabase** (<https://supabase.com>) → *New project* (región São Paulo `sa-east-1`).
2. **Base de datos:** *SQL Editor* → *New query* → pegá todo `supabase/schema.sql` → **Run**.
   Crea tablas, funciones, seguridad (RLS) y tiempo real. Se puede volver a correr sin perder datos.
3. **Auth** → *Sign In / Providers* → Email:
   - Recomendado: desactivar **Confirm email** (así los vendedores que crees pueden entrar enseguida).
   - *URL Configuration* → **Site URL** = la URL donde publiques la app (para los emails de recuperar contraseña).
4. **Variables:** `cp .env.local.example .env.local` y completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (las dos líneas que da el botón *Connect*)
   (*Project Settings → API*). La anon key es pública por diseño: la seguridad la dan las políticas RLS.
5. **Correr:**
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```
6. La primera vez, el login ofrece **crear el administrador general**: ese usuario gestiona los clientes (*Clientes*) y además es dueño de su propio comercio con plan completo.
   Después, en *Usuarios*, cada comercio da de alta a sus vendedores.
7. Cargá productos a mano o con *Productos → Importar* (`productos-ejemplo.csv` sirve de plantilla).

### Multi-comercio: una base para todos los clientes

Una sola base de Supabase y un solo deploy sirven a todos los comercios. Cada fila tiene `comercio_id` y las políticas RLS hacen que cada usuario vea **sólo su comercio**; las funciones que mueven stock o plata también filtran por comercio.

| Quién | Qué ve |
|---|---|
| **Administrador general** (vos) | Su comercio + la sección **Clientes**: alta de comercios, plan, vencimiento, suspensión, actividad (tickets y total de 30 días, última venta). **No** ve productos ni ventas de los clientes. |
| **Admin de un comercio** | Todo lo de su comercio (según el plan) y alta de sus usuarios |
| **Vendedor** | POS, caja, ventas del día y consulta de productos de su comercio |

**Dar de alta un cliente:** *Clientes → Nuevo cliente* → nombre del comercio, nombre/email del dueño, contraseña inicial, plan y vencimiento. Le pasás la URL, el email y la contraseña. (Si dejás la contraseña vacía, el dueño entra a la app, toca **«¿Te invitaron a un comercio? Creá tu cuenta»** y se registra con ese email).

| Plan | Incluye |
|---|---|
| `basico` | Punto de venta, Caja, Ventas, Productos, Stock, Usuarios y Configuración. **Sin** Inicio, Compras, Proveedores, Gastos, Reportes, Libro ni Facturación ARCA |
| `completo` | Todo |

**Vencimiento:** los últimos 7 días aparece un aviso. Pasada la fecha (o si lo suspendés), ese comercio queda en **modo consulta**: ve todo y puede cerrar la caja abierta, pero no vende, no abre caja ni modifica productos o stock. Lo bloquea la base, no sólo la pantalla. Desde *Clientes* lo extendés (+30), lo pasás a completo o le sacás el vencimiento, y la app del cliente se actualiza sola.

**Si alguien se registra sin invitación** no ve nada: la cuenta queda sin comercio hasta que un admin la invite con ese email.

**Cobro con QR de Mercado Pago (todos los planes):** cada comercio conecta su cuenta en *Configuración*; la caja genera el cobro por el monto exacto y la venta se confirma sola cuando Mercado Pago lo aprueba. Ver [`docs/MERCADOPAGO.md`](docs/MERCADOPAGO.md).

**Facturación ARCA:** cada comercio con plan completo carga **su** certificado en *Configuración* (se guarda cifrado en Supabase Vault). El servidor necesita una sola variable: `SUPABASE_SECRET_KEY`. Ver [`docs/FACTURACION-ARCA.md`](docs/FACTURACION-ARCA.md).

**Pasar la base que ya tenías (un comercio) a multi-comercio:** backup → `supabase/migrar_a_multicomercio.sql` → `supabase/schema.sql`. Tus datos quedan en un comercio con el nombre de tu configuración y plan completo; tu usuario admin pasa a ser el administrador general. Los tickets siguen la numeración que tenían.

**Scripts útiles:** `datos_prueba.sql` (carga 30 días de datos en tu comercio o en el que indiques) · `limpiar_datos.sql` (vacía UN comercio, indicando su nombre).

> Con varios clientes conviene **Supabase Pro** (8 GB, backups diarios). Un kiosco de ~200 tickets/día usa ~180 MB por año.

### Deploy
- **Vercel:** importar el repo y cargar las dos variables `NEXT_PUBLIC_SUPABASE_*`.
- **Servidor propio con PM2:** `npm run build && pm2 start npm --name caja-stock -- start` detrás de Apache como reverse proxy.
- Instalable como app (manifest incluido, abre directo en `/pos`).

## Base de datos (PostgreSQL)

```
comercios          nombre, plan (basico|completo), vence, activo, contacto, notas, ultimo_ticket
superadmins        user_id (administradores generales)
invitaciones       email, comercio_id, rol (se consumen cuando la persona crea su cuenta)
perfiles           id (= auth.users), comercio_id, nombre, email, rol (admin|vendedor), activo
config             comercio_id (PK): datos del ticket, preferencias, categorías y datos fiscales
productos          nombre, codigo (único por comercio), categoria, marca, costo, precio, stock, stock_min, proveedor_id, activo, favorito
ventas             numero (correlativo por comercio), fecha, subtotal, descuento, total, costo_total, pagos (jsonb), recibido, vuelto, caja_id, estado
venta_items        venta_id, producto_id, nombre, categoria, cantidad, precio, costo, subtotal
cajas              estado (una abierta por comercio), apertura, monto_inicial, cierre, por_medio, efectivo_esperado/contado, diferencia
movimientos_caja   caja_id, tipo (ingreso|egreso), monto, concepto
movimientos_stock  producto_id, tipo (venta|compra|ajuste|merma|vencido|anulacion|alta), cantidad, stock_anterior, stock_nuevo
compras            proveedor, items (jsonb), total, medio, pagado_desde_caja
gastos             fecha, categoria, descripcion, monto, medio, caja_id
vencimientos       producto_id, vence, cantidad, estado (pendiente|vendido|retirado), nota
proveedores        nombre, contacto, telefono, email, cuit, dias_visita
comprobantes       facturas y notas de crédito ARCA (CAE)
```
Todas las tablas de un comercio llevan `comercio_id` (obligatorio, por defecto el del usuario logueado).

**Funciones (RPC)** — toda operación que mueve stock o plata corre en una transacción en el servidor:
`registrar_venta`, `anular_venta`, `crear_producto`, `mover_stock`, `aumentar_precios`, `importar_productos`,
`registrar_compra`, `registrar_gasto`, `abrir_caja`, `movimiento_caja`, `cerrar_caja`, `invitar_usuario`.
Administrador general: `admin_comercios`, `admin_crear_comercio`, `admin_actualizar_comercio`, `admin_invitar`.

**Seguridad (RLS)**
- Cada usuario ve y modifica **sólo su comercio** (todas las políticas filtran por `comercio_id`; las funciones también, porque corren sin RLS).
- Vendedor: ve productos, la caja y las ventas del día; vende, abre/cierra caja y carga gastos pagados desde la caja. No ve costos de compras, gastos ni movimientos de stock, y no puede editar productos.
- Admin: todo. Igual, el stock no se puede pisar con un UPDATE directo (un trigger lo impide): sólo cambia por movimientos auditados.
- La venta toma **precios y costos de la base**, no del navegador; si cambió un precio mientras se cobraba, la venta se rechaza con aviso.

**Decisiones clave**
- Cada venta es una **transacción** en Postgres (`registrar_venta`): bloquea los productos, valida stock, numera el ticket, descuenta y registra movimientos. Si dos personas venden la última unidad a la vez, una recibe el aviso.
- El costo se guarda **en cada ítem vendido**: la ganancia histórica no cambia al actualizar costos.
- Las **compras de mercadería no son gastos** (ya están en el costo de lo vendido). Resultado neto = ventas − costo de lo vendido − gastos operativos.
- El stock sólo cambia por movimientos auditados (venta, compra, ajuste, anulación).
- Una sola caja abierta a la vez por comercio (un puesto de cobro), garantizado por un índice único.
- Las listas se traen paginando de a 1000 filas (límite por defecto de Supabase), así los reportes de meses con muchos tickets salen completos.

## Facturación electrónica

Guía completa (certificado, punto de venta, variables del servidor y pruebas): **[docs/FACTURACION-ARCA.md](docs/FACTURACION-ARCA.md)**.

## Ideas para siguientes etapas
- Cuenta corriente de clientes (fiado).
- Integración con la API de Mercado Pago Point/QR.
- Varias cajas simultáneas.
- Promos 2x1 / combos.
