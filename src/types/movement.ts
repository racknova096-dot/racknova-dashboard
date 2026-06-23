export interface MovementRecord {
  id: string;
  action: 'Ingreso' | 'Egreso' | 'Edición';
  productSku: string;
  productName: string;
  quantity: number;
  location: string; // rack-nivel-slot format
  user: string; // For now, we'll use "Admin" as default
  timestamp: Date;
  previousQuantity?: number; // For edits
  newQuantity?: number; // For edits
  //Campos financieros
  costo_proveedor?: number;
  precio_venta?: number;
  ingreso_total?: number;
  costo_total?: number;
  ganancia?: number;
}
