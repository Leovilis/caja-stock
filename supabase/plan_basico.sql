-- =====================================================================
--  CAJA & STOCK — Activar el PLAN BÁSICO de prueba para un cliente
--  Correr en el SQL Editor del proyecto Supabase DE ESE CLIENTE,
--  después de schema.sql. Se puede volver a correr para cambiar datos.
--
--  Plan básico: Punto de venta, Caja, Ventas, Productos, Stock, Usuarios y Configuración.
--  No incluye: Inicio, Compras, Proveedores, Gastos, Reportes, Libro ni Facturación ARCA.
--  Al vencer: modo consulta (ve todo y puede cerrar la caja, pero no vende ni modifica).
-- =====================================================================

update licencia set
  plan     = 'basico',
  vence    = current_date + 30,           -- último día de uso. Fecha fija: '2026-12-31'
  cliente  = 'Nombre del comercio',
  contacto = 'Leo — WhatsApp 11-XXXX-XXXX' -- aparece en los avisos de vencimiento
where id = 1;

select * from licencia;

-- ---------------------------------------------------------------------
-- Otras operaciones (descomentar la que necesites):
-- ---------------------------------------------------------------------
-- Extender la prueba 15 días más:
--   update licencia set vence = greatest(vence, current_date) + 15 where id = 1;
--
-- Lo compró: plan completo sin vencimiento
--   update licencia set plan = 'completo', vence = null where id = 1;
--
-- Lo compró pero sólo el básico, sin vencimiento:
--   update licencia set vence = null where id = 1;
