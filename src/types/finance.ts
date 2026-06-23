export interface SaleData {
  cantidad_vendida: number;
  precio_venta: number;
}

export interface FinancialSummary {
  ingresos: number;
  costos: number;
  ganancia: number;
}

export interface FinancialChartPoint {
  fecha: string;
  ingresos: number;
  costos: number;
  ganancia: number;
}
