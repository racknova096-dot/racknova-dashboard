import { apiJson } from "@/lib/api";

export type Proveedor = {
  id_proveedor: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  notas?: string | null;
  tiempo_entrega_dias: number;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
};

export type ProveedorInput = {
  nombre: string;
  contacto?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  notas?: string;
  tiempo_entrega_dias?: number;
  activo?: boolean;
};

export type ProductoProveedor = {
  id_relacion: string;
  sku: string;
  id_proveedor: string;
  proveedor?: string | null;
  es_principal: boolean;
  costo_ultimo: number;
  fecha_actualizacion?: string;
};

export type ReabastecimientoProducto = {
  sku: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  stock_objetivo: number;
  cantidad_sugerida: number;
  costo_unitario: number;
  subtotal_estimado: number;
};

export type ReabastecimientoGrupo = {
  id_proveedor: string | null;
  proveedor: string;
  contacto?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  tiempo_entrega_dias: number;
  productos: ReabastecimientoProducto[];
  total_productos: number;
  total_unidades_sugeridas: number;
  total_estimado: number;
};

export type ReabastecimientoResumen = {
  criterio: string;
  formula_sugerida: string;
  total_productos: number;
  total_proveedores: number;
  total_estimado: number;
  grupos: ReabastecimientoGrupo[];
};

export const listarProveedores = (incluirInactivos = false) =>
  apiJson<Proveedor[]>(
    `/compras/proveedores?incluir_inactivos=${incluirInactivos ? "true" : "false"}`
  );

export const crearProveedor = (data: ProveedorInput) =>
  apiJson<Proveedor>("/compras/proveedores", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const actualizarProveedor = (
  idProveedor: string,
  data: Partial<ProveedorInput>
) =>
  apiJson<Proveedor>(`/compras/proveedores/${encodeURIComponent(idProveedor)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const desactivarProveedor = (idProveedor: string) =>
  apiJson<{ ok: boolean; mensaje: string }>(
    `/compras/proveedores/${encodeURIComponent(idProveedor)}`,
    { method: "DELETE" }
  );

export const listarProveedoresProducto = (sku: string) =>
  apiJson<ProductoProveedor[]>(
    `/compras/productos/${encodeURIComponent(sku)}/proveedores`
  );

export const asignarProveedorPrincipal = (
  sku: string,
  idProveedor: string,
  costoUltimo = 0
) =>
  apiJson<ProductoProveedor>(
    `/compras/productos/${encodeURIComponent(sku)}/proveedor-principal`,
    {
      method: "PUT",
      body: JSON.stringify({
        id_proveedor: idProveedor,
        costo_ultimo: Number(costoUltimo || 0),
      }),
    }
  );

export const obtenerReabastecimiento = () =>
  apiJson<ReabastecimientoResumen>("/compras/reabastecimiento?solo_criticos=true");
