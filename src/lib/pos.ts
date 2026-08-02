import { apiFetch, apiJson } from "@/lib/api";

export type POSEstado = {
  habilitado: boolean;
  env_habilitado: boolean;
  config_habilitado: boolean;
  mensaje: string;
};

export type POSProducto = {
  id_producto: number;
  sku: string;
  codigo_barras?: string | null;
  nombre: string;
  descripcion?: string | null;
  cantidad: number;
  cantidad_disponible_venta?: number;
  precio_venta_sugerido: number;
  costo_proveedor: number;
  ubicacion: string;
  rack: string;
  nivel: string;
  slot: string;
  caducidad?: string | null;
  unidad_venta?: string;
  permite_fraccion?: boolean;
  factor_inventario?: number;
  precio_mayoreo?: number | null;
  cantidad_mayoreo?: number;
  precio_minimo?: number | null;
};

export type POSCaja = {
  id_caja: number;
  nombre: string;
  activa: boolean;
  fecha_creacion?: string;
  creada_por?: string;
};

export type POSMovimientoEfectivo = {
  id_movimiento: number;
  tipo: string;
  monto: number;
  motivo: string;
  usuario: string;
  fecha: string;
};

export type POSSesionCaja = {
  id_sesion: number;
  id_caja: number;
  caja_nombre: string;
  usuario: string;
  estado: "ABIERTA" | "CERRADA";
  fondo_inicial: number;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  ventas_completadas: number;
  ventas_canceladas: number;
  total_ventas: number;
  efectivo_ventas: number;
  tarjeta: number;
  transferencia: number;
  abonos_efectivo?: number;
  abonos_tarjeta?: number;
  abonos_transferencia?: number;
  entradas_efectivo: number;
  salidas_efectivo: number;
  reembolsos_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado?: number | null;
  diferencia?: number | null;
  observaciones?: string | null;
  movimientos_efectivo: POSMovimientoEfectivo[];
};

export type POSVentaResumen = {
  id_venta: number;
  folio: string;
  usuario: string;
  subtotal: number;
  descuento_total: number;
  total: number;
  costo_total: number;
  ganancia: number;
  efectivo_recibido: number;
  cambio: number;
  estado: string;
  fecha: string;
  id_sesion?: number | null;
  operacion_id?: string | null;
  motivo_anulacion?: string | null;
  fecha_anulacion?: string | null;
  id_cliente?: number | null;
  cliente_nombre?: string | null;
  tipo_venta?: "CONTADO" | "CREDITO" | "PARCIAL";
  saldo_pendiente?: number;
  fecha_vencimiento?: string | null;
  descuento_promociones?: number;
};

export type POSVentaDetalleItem = {
  id_detalle: number;
  id_producto?: number | null;
  sku: string;
  codigo_barras?: string | null;
  nombre: string;
  cantidad: number;
  cantidad_devuelta: number;
  cantidad_inventario?: number;
  unidad_venta?: string;
  factor_inventario?: number;
  precio_lista: number;
  descuento_porcentaje: number;
  descuento_automatico?: number;
  promocion_nombre?: string | null;
  precio_origen?: string;
  precio_unitario_final: number;
  subtotal: number;
  costo_unitario: number;
  costo_total: number;
  ganancia: number;
};

export type POSVentaDetalle = POSVentaResumen & {
  mensaje?: string;
  duplicada?: boolean;
  items: POSVentaDetalleItem[];
  pagos: Array<{
    id_pago: number;
    metodo: string;
    monto: number;
    referencia?: string | null;
  }>;
};

export type POSCliente = {
  id_cliente: number;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  rfc?: string | null;
  direccion?: string | null;
  limite_credito: number;
  dias_credito: number;
  notas?: string | null;
  activo: boolean;
  saldo: number;
  vencido: number;
  credito_disponible: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
};

export type POSClientePayload = Omit<
  POSCliente,
  | "id_cliente"
  | "saldo"
  | "vencido"
  | "credito_disponible"
  | "fecha_creacion"
  | "fecha_actualizacion"
>;

export type POSCredito = {
  id_credito: number;
  id_venta: number;
  id_cliente: number;
  cliente_nombre?: string | null;
  folio_venta?: string | null;
  total_credito: number;
  saldo: number;
  fecha_vencimiento: string;
  estado: string;
  usuario_autorizo: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
};

export type POSAbono = {
  id_abono: number;
  folio: string;
  id_credito: number;
  id_cliente: number;
  id_sesion?: number | null;
  metodo: string;
  monto: number;
  referencia?: string | null;
  usuario: string;
  fecha: string;
};

export type POSPromocion = {
  id_promocion: number;
  nombre: string;
  tipo: "PORCENTAJE" | "PRECIO_FIJO" | "NXM";
  sku?: string | null;
  porcentaje: number;
  precio_fijo: number;
  cantidad_minima: number;
  compra_cantidad: number;
  paga_cantidad: number;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  prioridad: number;
  activa: boolean;
  fecha_creacion: string;
  creada_por: string;
};

export type POSPromocionPayload = Omit<
  POSPromocion,
  "id_promocion" | "fecha_creacion" | "creada_por"
>;

export type POSProductoConfiguracion = {
  id_configuracion?: number;
  sku: string;
  unidad_venta: string;
  permite_fraccion: boolean;
  factor_inventario: number;
  precio_normal?: number | null;
  precio_mayoreo?: number | null;
  cantidad_mayoreo: number;
  precio_minimo?: number | null;
  activo: boolean;
  fecha_actualizacion?: string;
  actualizado_por?: string;
};

export type POSReporteDiario = {
  fecha: string;
  generado_en: string;
  resumen: {
    numero_ventas: number;
    ventas_canceladas: number;
    devoluciones: number;
    ventas_brutas: number;
    descuentos: number;
    ventas_antes_devoluciones: number;
    monto_devoluciones: number;
    ventas_netas: number;
    costo_mercancia: number;
    ganancia: number;
    margen: number;
    abonos: number;
  };
  metodos_pago: Record<string, number>;
  productos: Array<{
    sku: string;
    nombre: string;
    unidad_venta: string;
    cantidad: number;
    ingresos: number;
    ganancia: number;
  }>;
  movimientos_productos: Array<{
    id_venta: number;
    id_detalle: number;
    folio: string;
    fecha: string;
    usuario: string;
    caja: string;
    sku: string;
    nombre: string;
    ubicacion: string;
    unidad_venta: string;
    cantidad_vendida: number;
    cantidad_devuelta: number;
    cantidad_neta: number;
    ingresos: number;
    ganancia: number;
  }>;
  cajeros: Array<{ usuario: string; ventas: number; total: number }>;
  cajas: Array<{ caja: string; ventas: number; total: number }>;
  ventas_por_hora: Array<{ hora: string; total: number }>;
  cortes: POSSesionCaja[];
};

export type POSCotizacion = {
  items: Array<{
    sku: string;
    nombre: string;
    factor: number;
    base_unit: number;
    line_list: number;
    automatic_total: number;
    automatic_discount: number;
    manual_discount_amount: number;
    final_total: number;
    final_unit: number;
    cost_unit: number;
    cost_total: number;
    profit: number;
    promotion_name?: string | null;
    origin: string;
  }>;
  total: number;
};

export const obtenerEstadoPOS = () => apiJson<POSEstado>("/pos/estado");

export const cambiarEstadoPOS = (activo: boolean) =>
  apiJson<POSEstado>("/pos/configuracion", {
    method: "PUT",
    body: JSON.stringify({ activo }),
  });

export const listarCajasPOS = () => apiJson<POSCaja[]>("/pos/cajas");

export const crearCajaPOS = (nombre: string) =>
  apiJson<POSCaja & { mensaje: string }>("/pos/cajas", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });

export const cambiarEstadoCajaPOS = (idCaja: number, activa: boolean) =>
  apiJson<{ id_caja: number; activa: boolean }>(`/pos/cajas/${idCaja}/estado`, {
    method: "PUT",
    body: JSON.stringify({ activa }),
  });

export const obtenerSesionActualPOS = () =>
  apiJson<{ abierta: boolean; sesion: POSSesionCaja | null }>(
    "/pos/v3/caja/sesion-actual"
  );

export const abrirCajaPOS = (idCaja: number, fondoInicial: number) =>
  apiJson<{ mensaje: string; sesion: POSSesionCaja }>("/pos/caja/abrir", {
    method: "POST",
    body: JSON.stringify({ id_caja: idCaja, fondo_inicial: fondoInicial }),
  });

export const registrarMovimientoEfectivoPOS = (payload: {
  tipo: string;
  monto: number;
  motivo: string;
}) =>
  apiJson<{ mensaje: string; sesion: POSSesionCaja }>(
    "/pos/caja/movimientos",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

export const cerrarCajaPOS = (payload: {
  efectivo_contado: number;
  observaciones?: string | null;
}) =>
  apiJson<{ mensaje: string; sesion: POSSesionCaja }>("/pos/v3/caja/cerrar", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarSesionesCajaPOS = (limite = 30) =>
  apiJson<POSSesionCaja[]>(`/pos/caja/sesiones?limite=${limite}`);

export const buscarProductosPOS = (query: string, idCliente?: number | null) =>
  apiJson<POSProducto[]>(
    `/pos/v3/productos/buscar?query=${encodeURIComponent(query)}&limite=20${
      idCliente ? `&id_cliente=${idCliente}` : ""
    }`
  );

export type POSVentaPayload = {
  operacion_id: string;
  items: Array<{
    sku: string;
    cantidad: number;
    descuento_porcentaje: number;
  }>;
  pagos: Array<{
    metodo: "efectivo" | "tarjeta" | "transferencia";
    monto: number;
    referencia?: string | null;
  }>;
  efectivo_recibido?: number | null;
  id_cliente?: number | null;
  tipo_venta?: "CONTADO" | "CREDITO" | "PARCIAL";
  fecha_vencimiento?: string | null;
};

export const crearVentaPOS = (payload: POSVentaPayload) =>
  apiJson<POSVentaDetalle>("/pos/v3/ventas", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const cotizarVentaPOS = (payload: POSVentaPayload) =>
  apiJson<POSCotizacion>("/pos/v3/cotizar", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarVentasPOS = (limite = 50) =>
  apiJson<POSVentaResumen[]>(`/pos/v3/ventas?limite=${limite}`);

export const obtenerVentaPOS = (idVenta: number) =>
  apiJson<POSVentaDetalle>(`/pos/v3/ventas/${idVenta}`);

export const cancelarVentaPOS = (idVenta: number, motivo: string) =>
  apiJson<POSVentaDetalle>(`/pos/v3/ventas/${idVenta}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });

export const devolverVentaPOS = (
  idVenta: number,
  payload: {
    items: Array<{ id_detalle: number; cantidad: number }>;
    motivo: string;
    metodo_reembolso: "efectivo" | "tarjeta" | "transferencia";
  }
) =>
  apiJson<{
    mensaje: string;
    id_devolucion: number;
    monto: number;
    ajuste_credito: number;
    reembolso_real: number;
    venta: POSVentaDetalle;
  }>(`/pos/v3/ventas/${idVenta}/devoluciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarClientesPOS = (query = "", includeInactive = false) =>
  apiJson<POSCliente[]>(
    `/pos/v3/clientes?query=${encodeURIComponent(query)}&include_inactive=${includeInactive}`
  );

export const crearClientePOS = (payload: POSClientePayload) =>
  apiJson<POSCliente>("/pos/v3/clientes", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const actualizarClientePOS = (
  idCliente: number,
  payload: POSClientePayload
) =>
  apiJson<POSCliente>(`/pos/v3/clientes/${idCliente}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const obtenerEstadoCuentaPOS = (idCliente: number) =>
  apiJson<{
    cliente: POSCliente;
    creditos: Array<
      POSCredito & {
        abonos: POSAbono[];
      }
    >;
  }>(`/pos/v3/clientes/${idCliente}/estado-cuenta`);

export const listarCreditosPOS = (params?: {
  estado?: string;
  idCliente?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.estado) query.set("estado", params.estado);
  if (params?.idCliente) query.set("client_id", String(params.idCliente));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiJson<POSCredito[]>(`/pos/v3/creditos${suffix}`);
};

export const registrarAbonoPOS = (
  idCredito: number,
  payload: {
    monto: number;
    metodo: "efectivo" | "tarjeta" | "transferencia";
    referencia?: string | null;
  }
) =>
  apiJson<{
    mensaje: string;
    abono: POSAbono;
    credito: POSCredito;
    sesion: POSSesionCaja;
  }>(`/pos/v3/creditos/${idCredito}/abonos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarPromocionesPOS = (includeInactive = true) =>
  apiJson<POSPromocion[]>(
    `/pos/v3/promociones?include_inactive=${includeInactive}`
  );

export const crearPromocionPOS = (payload: POSPromocionPayload) =>
  apiJson<POSPromocion>("/pos/v3/promociones", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const actualizarPromocionPOS = (
  idPromocion: number,
  payload: POSPromocionPayload
) =>
  apiJson<POSPromocion>(`/pos/v3/promociones/${idPromocion}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const listarConfiguracionesProductoPOS = (query = "") =>
  apiJson<POSProductoConfiguracion[]>(
    `/pos/v3/productos/configuracion?query=${encodeURIComponent(query)}`
  );

export const guardarConfiguracionProductoPOS = (
  sku: string,
  payload: POSProductoConfiguracion
) =>
  apiJson<POSProductoConfiguracion>(
    `/pos/v3/productos/configuracion/${encodeURIComponent(sku)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const guardarPrecioClientePOS = (payload: {
  id_cliente: number;
  sku: string;
  precio: number;
  activo: boolean;
}) =>
  apiJson("/pos/v3/precios-cliente", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const obtenerReporteDiarioPOS = (fecha: string) =>
  apiJson<POSReporteDiario>(
    `/pos/v3/reportes/diario?fecha=${encodeURIComponent(fecha)}`
  );

export const cerrarReporteDiarioPOS = (fecha: string) =>
  apiJson<{ mensaje: string; reporte: POSReporteDiario }>(
    `/pos/v3/reportes/diario/cerrar?fecha=${encodeURIComponent(fecha)}`,
    { method: "POST" }
  );

export const obtenerReporteRangoPOS = (desde: string, hasta: string) =>
  apiJson<{
    desde: string;
    hasta: string;
    dias: Array<Record<string, number | string>>;
    totales: {
      ventas_netas: number;
      ganancia: number;
      numero_ventas: number;
      devoluciones: number;
    };
  }>(
    `/pos/v3/reportes/rango?desde=${encodeURIComponent(
      desde
    )}&hasta=${encodeURIComponent(hasta)}`
  );

export const descargarReportePOS = async (
  fecha: string,
  formato: "pdf" | "xlsx"
) => {
  const response = await apiFetch(
    `/pos/v3/reportes/diario.${formato}?fecha=${encodeURIComponent(fecha)}`
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "No se pudo descargar el reporte.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `racknova-ventas-${fecha}.${formato}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
