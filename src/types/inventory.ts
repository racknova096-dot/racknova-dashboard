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

  /**
   * En backend ahora esta caducidad representa la caducidad
   * más próxima vigente calculada desde los lotes activos.
   */
  caducidad?: string | null;

  stock_minimo?: number;
  stock_alto?: number;
}

export interface ProductWithLocation extends Product {
  location: Location;
}

/**
 * Catálogo histórico:
 * SOLO guarda identidad fija del producto.
 * No debe guardar costo, stock, precio ni caducidad.
 */
export interface ProductoCatalogo {
  id_catalogo?: number;

  sku: string;
  nombre: string;
  descripcion?: string | null;

  fecha_creacion?: string;
  ultima_actualizacion?: string;
}

/**
 * Lotes del producto:
 * Sirven para diferenciar caducidades.
 */
export interface ProductoLote {
  id_lote?: number;

  sku: string;
  nombre: string;

  cantidad_inicial: number;
  cantidad_actual: number;

  costo_unitario: number;
  caducidad?: string | null;

  fecha_ingreso?: string;
}

export type Rack = "A" | "B" | "C" | "D" | "E";
export type Nivel = 1 | 2 | 3;
