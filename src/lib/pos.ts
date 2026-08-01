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
};

export type POSVentaDetalle = POSVentaResumen & {
  mensaje?: string;
  items: Array<{
    id_detalle: number;
    id_producto?: number | null;
    sku: string;
    codigo_barras?: string | null;
    nombre: string;
    cantidad: number;
    precio_lista: number;
    descuento_porcentaje: number;
    precio_unitario_final: number;
    subtotal: number;
    costo_unitario: number;
    costo_total: number;
    ganancia: number;
  }>;
  pagos: Array<{
    id_pago: number;
    metodo: string;
    monto: number;
    referencia?: string | null;
  }>;
};

export const obtenerEstadoPOS = () =>
  apiJson<POSEstado>("/pos/estado");

export const cambiarEstadoPOS = (activo: boolean) =>
  apiJson<POSEstado>("/pos/configuracion", {
    method: "PUT",
    body: JSON.stringify({ activo }),
  });

export const buscarProductosPOS = (query: string) =>
  apiJson<POSProducto[]>(
    `/pos/productos/buscar?query=${encodeURIComponent(query)}&limite=20`
  );

export const crearVentaPOS = (payload: {
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
