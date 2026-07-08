export type SlotStatus = "libre" | "en_proceso" | "ocupado" | "quitando";

export interface Location {
  id: string;
  rack: string;
  nivel: number;
  slot: number;
  status: SlotStatus;
}

export interface Product {
  id: string;
  locationId: string;
  sku: string;
  nombre: string;
  descripcion?: string | null;
  cantidad: number;

  costo_proveedor: number;
  precio_venta_sugerido?: number;

  caducidad?: string | null;
  stock_minimo?: number;
  stock_alto?: number;
}

export interface ProductWithLocation extends Product {
  location: Location;
}

export interface ProductoCatalogo {
  id_catalogo?: number;
  sku: string;
  nombre: string;
  descripcion?: string | null;

  ultimo_costo_proveedor?: number;
  costo_promedio?: number;
  precio_venta_sugerido?: number;

  caducidad?: string | null;
  stock_minimo?: number;
  stock_alto?: number;

  total_ingresado?: number;
  total_vendido?: number;
  ultima_actualizacion?: string;
}

export type Rack = "A" | "B" | "C" | "D" | "E";
export type Nivel = 1 | 2 | 3;
