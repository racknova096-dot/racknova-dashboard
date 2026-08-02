import { apiJson } from "@/lib/api";

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
  precio_venta_sugerido: number;
  costo_proveedor: number;
  ubicacion: string;
  rack: string;
  nivel: string;
  slot: string;
  caducidad?: string | null;
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
};

export type POSVentaDetalleItem = {
  id_detalle: number;
  id_producto?: number | null;
  sku: string;
  codigo_barras?: string | null;
  nombre: string;
  cantidad: number;
  cantidad_devuelta: number;
  precio_lista: number;
  descuento_porcentaje: number;
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
    "/pos/caja/sesion-actual"
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
  apiJson<{ mensaje: string; sesion: POSSesionCaja }>("/pos/caja/cerrar", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarSesionesCajaPOS = (limite = 30) =>
  apiJson<POSSesionCaja[]>(`/pos/caja/sesiones?limite=${limite}`);

export const buscarProductosPOS = (query: string) =>
  apiJson<POSProducto[]>(
    `/pos/productos/buscar?query=${encodeURIComponent(query)}&limite=20`
  );

export const crearVentaPOS = (payload: {
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
}) =>
  apiJson<POSVentaDetalle>("/pos/ventas", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listarVentasPOS = (limite = 50) =>
  apiJson<POSVentaResumen[]>(`/pos/ventas?limite=${limite}`);

export const obtenerVentaPOS = (idVenta: number) =>
  apiJson<POSVentaDetalle>(`/pos/ventas/${idVenta}`);

export const cancelarVentaPOS = (idVenta: number, motivo: string) =>
  apiJson<POSVentaDetalle>(`/pos/ventas/${idVenta}/cancelar`, {
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
    folio: string;
    monto: number;
    metodo_reembolso: string;
    venta: POSVentaDetalle;
  }>(`/pos/ventas/${idVenta}/devoluciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
