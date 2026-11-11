/**
 * Guías de mikiosko.com.ar (contenido para buscadores).
 * Para sumar una: agregá un objeto acá. La página, el índice y el sitemap se arman solos.
 */
export interface Seccion {
  h: string;
  p?: string[];
  lista?: string[];
  pasos?: string[];
}
export interface Guia {
  slug: string;
  titulo: string; // <title> y H1 (hasta ~60 caracteres)
  descripcion: string; // meta descripción (hasta ~155 caracteres)
  resumen: string; // bajada en el índice
  fecha: string; // yyyy-mm-dd
  lectura: number; // minutos
  intro: string;
  secciones: Seccion[];
  cierre: string; // cómo lo resuelve Mostrador
}

export const GUIAS: Guia[] = [
  {
    slug: "cierre-de-caja-kiosco",
    titulo: "Cómo hacer el cierre de caja de un kiosco",
    descripcion: "Paso a paso para cerrar la caja de tu kiosco sin errores: fondo inicial, retiros, conteo de billetes y cómo encontrar un faltante.",
    resumen: "Fondo, retiros, conteo de billetes y qué hacer cuando falta plata.",
    fecha: "2026-11-10",
    lectura: 5,
    intro:
      "El cierre de caja es el momento en que sabés si el día cerró bien. Hecho siempre igual, te avisa a tiempo de errores de vuelto, ventas sin registrar o plata que falta. Hecho a las apuradas, los faltantes se acumulan y después nadie sabe de dónde salieron.",
    secciones: [
      {
        h: "1. Abrí siempre con un fondo fijo",
        p: [
          "El fondo (o cambio) es la plata con la que arrancás el turno. Conviene que sea siempre el mismo monto, por ejemplo $20.000 en billetes chicos y monedas, y que quede anotado al abrir.",
          "Si el fondo cambia todos los días o no se anota, el cierre no va a cerrar nunca: no vas a saber si la diferencia es del fondo o de las ventas.",
        ],
      },
      {
        h: "2. Anotá cada plata que entra o sale que no es una venta",
        p: ["La mayoría de los faltantes no son robos: son movimientos que no se anotaron. Durante el día registrá:"],
        lista: [
          "Retiros del dueño (cuando sacás plata para depositar o para vos).",
          "Pagos a proveedores o repartidores con efectivo de la caja.",
          "Gastos chicos: bolsas, artículos de limpieza, un flete.",
          "Ingresos de cambio extra cuando te quedás sin billetes chicos.",
        ],
      },
      {
        h: "3. Separá el efectivo de lo demás",
        p: [
          "En el arqueo solo se cuenta el efectivo. Las ventas con débito, crédito, transferencia o QR ya figuran en tus cuentas: no hace falta contarlas, pero sí conviene revisar que el total del día coincida con lo que informa el posnet o Mercado Pago.",
        ],
      },
      {
        h: "4. Calculá cuánto efectivo debería haber",
        p: ["La cuenta es siempre la misma:"],
        lista: ["Fondo inicial", "+ ventas en efectivo", "+ ingresos de efectivo", "− retiros, pagos y gastos con efectivo", "= efectivo esperado"],
      },
      {
        h: "5. Contá los billetes por denominación",
        pasos: [
          "Separá los billetes por valor y contá cuántos hay de cada uno.",
          "Multiplicá y sumá (o anotalo en el sistema, que suma solo).",
          "Compará lo contado con el efectivo esperado: la diferencia es el sobrante o el faltante.",
          "Guardá el fondo para el día siguiente y retirá el resto.",
        ],
      },
      {
        h: "6. Si falta plata, revisá en este orden",
        lista: [
          "Un retiro o pago con efectivo que no se anotó.",
          "Una venta cobrada con tarjeta o QR que se registró como efectivo (o al revés).",
          "Un vuelto mal dado: suele ser un billete de diferencia ($1.000, $2.000, $10.000).",
          "Una venta anulada que en realidad se cobró.",
        ],
        p: ["Anotá siempre la diferencia, aunque sea chica. Si se repite con el mismo turno o el mismo empleado, ya tenés una pista."],
      },
    ],
    cierre:
      "En Mostrador abrís la caja con el fondo, registrás retiros y pagos con un toque, y al cerrar contás los billetes por denominación: el sistema calcula el efectivo esperado y te muestra el faltante o sobrante antes de confirmar. Cada cierre queda guardado con su responsable.",
  },
  {
    slug: "cobrar-con-qr-mercado-pago-kiosco",
    titulo: "Cobrar con QR de Mercado Pago en el kiosco",
    descripcion: "Cómo cobrar con QR de Mercado Pago en tu kiosco sin depender de capturas de pantalla, cómo evitar pagos falsos y cómo controlar las comisiones.",
    resumen: "QR fijo, QR por monto, pagos falsos y comisiones: lo que conviene saber.",
    fecha: "2026-11-10",
    lectura: 4,
    intro:
      "El QR de Mercado Pago es hoy uno de los medios de pago más usados en los kioscos. Es rápido y el cliente lo tiene a mano, pero mal usado trae dos problemas: cobros que nunca entraron y comisiones que no tenés en cuenta al calcular tu ganancia.",
    secciones: [
      {
        h: "QR fijo o QR por monto",
        p: [
          "Con el QR fijo (el cartel pegado en el mostrador), el cliente escanea y escribe el monto. Es simple, pero se puede equivocar al tipear y vos tenés que verificar cada pago en el celular.",
          "Con el QR por monto, el sistema de caja genera el cobro por el importe exacto del ticket. El cliente solo confirma, y cuando Mercado Pago aprueba el pago, la caja se entera sola.",
        ],
      },
      {
        h: "Cuidado con las capturas de pantalla",
        p: [
          "La estafa más común es mostrar una captura de un pago viejo o editado. Una captura no prueba nada: lo único que vale es que el pago figure aprobado en tu cuenta.",
        ],
        lista: [
          "No entregues la mercadería mirando el celular del cliente.",
          "Verificá el pago en tu app de Mercado Pago o, mejor, que lo confirme el sistema de caja.",
          "Revisá que el monto sea exactamente el del ticket.",
        ],
      },
      {
        h: "Las comisiones también son un costo",
        p: [
          "Cobrar con QR o tarjeta tiene comisión, y varía según el medio (dinero en cuenta, débito o crédito) y el plazo en que querés la plata. Las tasas cambian: consultalas en tu cuenta de Mercado Pago.",
          "Si no las descontás, tus números te van a mostrar una ganancia más alta que la real. Algunos comercios aplican un recargo a ciertos medios de pago: si lo hacés, informalo antes de cobrar.",
        ],
      },
      {
        h: "Cómo llevar el control al final del día",
        pasos: [
          "Separá en el cierre lo cobrado con QR del efectivo.",
          "Compará el total de QR de tu caja con el de la app de Mercado Pago.",
          "Si no coincide, buscá ventas cargadas con el medio equivocado.",
        ],
      },
    ],
    cierre:
      "Mostrador genera el cobro con QR de Mercado Pago por el monto exacto del ticket y registra la venta sola cuando el pago queda aprobado: sin capturas, sin tipeos. Cada medio de cobro tiene su comisión configurada, así los reportes muestran lo que realmente te queda.",
  },
  {
    slug: "cuanto-gana-un-kiosco",
    titulo: "Cuánto ganás de verdad en tu kiosco",
    descripcion: "Margen, costo de mercadería, gastos y comisiones: cómo calcular la ganancia real de un kiosco o almacén y qué números mirar cada mes.",
    resumen: "Ventas no es ganancia: cómo calcular el resultado real del mes.",
    fecha: "2026-11-10",
    lectura: 5,
    intro:
      "Muchos kioscos facturan bien y aun así a fin de mes no queda plata. La razón casi siempre es la misma: se mira lo que se vende, no lo que se gana. Estos son los números que tenés que tener claros.",
    secciones: [
      {
        h: "Ventas, ganancia bruta y resultado neto",
        lista: [
          "Ventas: todo lo que cobraste.",
          "Costo de lo vendido: lo que te costó la mercadería que vendiste.",
          "Ganancia bruta = ventas − costo de lo vendido.",
          "Gastos del negocio: alquiler, luz, internet, sueldos, impuestos, comisiones.",
          "Resultado neto = ganancia bruta − gastos. Esto es lo que realmente ganaste.",
        ],
      },
      {
        h: "Margen y recargo no son lo mismo",
        p: [
          "Si un producto te cuesta $1.000 y lo vendés a $1.500, le pusiste un 50% de recargo sobre el costo, pero tu margen sobre la venta es del 33% ($500 de $1.500).",
          "Confundirlos lleva a creer que ganás más de lo que ganás. Elegí una forma de calcular y usala siempre igual.",
        ],
      },
      {
        h: "Las compras de mercadería no son un gasto",
        p: [
          "Un error común es restar todo lo que se pagó a proveedores en el mes. La mercadería que compraste y todavía está en la góndola no es un gasto: es stock. Lo que se resta es el costo de lo que efectivamente vendiste.",
        ],
      },
      {
        h: "Lo que se lleva la ganancia sin que lo veas",
        lista: [
          "Aumentos de los proveedores que no trasladaste al precio.",
          "Comisiones de tarjetas y QR.",
          "Mercadería vencida, rota o faltante.",
          "Descuentos y \"redondeos\" que se hacen sin anotar.",
          "Retiros del dueño que no se cuentan como sueldo.",
        ],
      },
      {
        h: "Qué mirar cada mes",
        pasos: [
          "Resultado neto del mes y comparación con el mes anterior.",
          "Margen por categoría: cuáles te dejan más y cuáles casi nada.",
          "Los productos que más ganancia dejan (no solo los que más se venden).",
          "Gastos fijos sobre ventas: si crecen más que las ventas, hay que ajustar.",
        ],
      },
    ],
    cierre:
      "Mostrador guarda el costo de cada producto vendido, descuenta las comisiones de cada medio de cobro y resta los gastos que cargás: el reporte del mes te muestra ventas, ganancia bruta, gastos y resultado neto, y el ranking de productos por ganancia.",
  },
  {
    slug: "control-de-stock-kiosco",
    titulo: "Control de stock en un kiosco: guía práctica",
    descripcion: "Cómo llevar el stock de un kiosco o almacén: stock mínimo, reposición por proveedor, vencimientos, inventario y cómo evitar faltantes.",
    resumen: "Stock mínimo, pedidos por proveedor, vencimientos e inventarios.",
    fecha: "2026-11-10",
    lectura: 5,
    intro:
      "En un kiosco el stock se pierde de a poco: un producto que se agotó un viernes, una caja de alfajores vencida, un pack que se rompió y nadie anotó. Con un control simple se evita la mayoría.",
    secciones: [
      {
        h: "Definí un stock mínimo para cada producto",
        p: [
          "El stock mínimo es la cantidad a partir de la cual tenés que reponer. Una regla práctica: lo que vendés entre una visita del proveedor y la siguiente, más un margen para los días de más movimiento.",
          "Así no dependés de mirar la góndola: cuando un producto baja del mínimo, entra en la lista de reposición.",
        ],
      },
      {
        h: "Armá los pedidos por proveedor",
        p: ["Agrupá los productos a reponer según quién te los vende. Cuando llega el preventista, ya tenés el pedido listo con las cantidades sugeridas."],
      },
      {
        h: "Cargá todo lo que entra",
        p: [
          "Cada compra tiene que sumar stock y actualizar el costo. Si el proveedor aumentó y no lo cargás, vas a seguir vendiendo con el margen viejo sin darte cuenta.",
        ],
      },
      {
        h: "Controlá los vencimientos",
        lista: [
          "Anotá la fecha de vencimiento de lo que entra, sobre todo lácteos, golosinas y bebidas.",
          "Poné adelante lo que vence primero.",
          "Revisá cada semana lo que vence en los próximos días y ofrecelo antes de que sea pérdida.",
        ],
      },
      {
        h: "Hacé inventarios cortos y seguidos",
        p: [
          "No hace falta contar todo el local. Elegí una categoría por semana (cigarrillos, bebidas alcohólicas, lo más caro o lo que más se pierde), contala y ajustá las diferencias anotando el motivo: rotura, vencido o faltante.",
        ],
      },
    ],
    cierre:
      "En Mostrador cada producto tiene su stock mínimo, la lista de reposición se arma sola agrupada por proveedor y se exporta como pedido. Las compras suman stock y actualizan costos, los vencimientos te avisan antes de tiempo y cada ajuste queda registrado con su motivo.",
  },
];

export const guiaPorSlug = (slug: string) => GUIAS.find((g) => g.slug === slug);
