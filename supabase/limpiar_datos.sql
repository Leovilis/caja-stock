-- =====================================================================
--  LIMPIAR DATOS DE UN COMERCIO — lo deja vacío para empezar a usarlo en serio.
--  Borra: ventas, cajas, movimientos, compras, gastos, productos y proveedores
--  DEL COMERCIO indicado. CONSERVA: usuarios, configuración y los demás comercios.
--  ¡No se puede deshacer! Borra también la copia local de las facturas emitidas
--  (en ARCA siguen existiendo): si ya facturaste en producción, exportalas antes.
-- =====================================================================
do $$
declare
  v_comercio text := 'NOMBRE EXACTO DEL COMERCIO';   -- ← cambiar
  v_com uuid;
begin
  select id into v_com from comercios where nombre = v_comercio;
  if v_com is null then raise exception 'No existe el comercio "%"', v_comercio; end if;
  delete from comprobantes      where comercio_id = v_com;
  delete from venta_items       where comercio_id = v_com;
  delete from ventas            where comercio_id = v_com;
  delete from movimientos_caja  where comercio_id = v_com;
  delete from movimientos_stock where comercio_id = v_com;
  delete from compras           where comercio_id = v_com;
  delete from gastos            where comercio_id = v_com;
  delete from cajas             where comercio_id = v_com;
  delete from productos         where comercio_id = v_com;
  delete from proveedores       where comercio_id = v_com;
  update comercios set ultimo_ticket = 0 where id = v_com;
  raise notice 'Comercio "%" vacío. La numeración de tickets vuelve a empezar en 1.', v_comercio;
end $$;
