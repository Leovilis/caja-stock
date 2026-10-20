-- =====================================================================
--  LIMPIAR DATOS — deja la base vacía para empezar a usarla en serio.
--  Borra: ventas, cajas, movimientos, compras, gastos, productos y proveedores.
--  CONSERVA: usuarios (perfiles) y la configuración del negocio.
--  ¡No se puede deshacer! Borra también la copia local de las facturas emitidas
--  (en ARCA siguen existiendo): si ya facturaste en producción, exportalas antes.
-- =====================================================================
truncate table comprobantes, venta_items, ventas, movimientos_caja, movimientos_stock, compras, gastos, cajas, productos, proveedores restart identity cascade;
alter sequence ventas_numero_seq restart with 1;
