export type SlotStatus = 'libre' | 'en_proceso' | 'ocupado'| 'quitando';

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
  cantidad: number;
}

export interface ProductWithLocation extends Product {
  location: Location;
}

export type Rack = 'A' | 'B' | 'C' | 'D' | 'E';
export type Nivel = 1 | 2 | 3;