import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import {
  FinancialChartPoint,
  FinancialSummary,
} from "@/types/finance";
import { useInventory } from "@/context/InventoryContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProductProfitReport {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
}

export default function Finanzas() {
  const { movements } = useInventory();

  const [resumen, setResumen] = useState<FinancialSummary>({
    ingresos: 0,
    costos: 0,
    ganancia: 0,
  });

  const [grafica, setGrafica] = useState<FinancialChartPoint[]>([]);

  useEffect(() => {
    const loadFinance = async () => {
      try {
        const resumenResp = await fetch(`${API_URL}/finanzas/resumen`);

        if (resumenResp.ok) {
          const resumenData = await resumenResp.json();

          setResumen({
            ingresos: Number(resumenData.ingresos ?? 0),
            costos: Number(resumenData.costos ?? 0),
            ganancia: Number(resumenData.ganancia ?? 0),
          });
        }

        const graficaResp = await fetch(`${API_URL}/finanzas/grafica`);

        if (graficaResp.ok) {
          const graficaData = await graficaResp.json();
          setGrafica(graficaData);
        }
      } catch (error) {
        console.error("Error cargando finanzas:", error);
      }
    };

    loadFinance();
  }, []);

  const money = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value || 0));

  const productProfitReports = useMemo(() => {
    const map = new Map<string, ProductProfitReport>();

    movements
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const sku = movement.productSku;
        const current = map.get(sku);

        if (current) {
          current.cantidadVendida += Number(movement.quantity ?? 0);
          current.ingresoTotal += Number(movement.ingreso_total ?? 0);
          current.costoTotal += Number(movement.costo_total ?? 0);
          current.gananciaTotal += Number(movement.ganancia ?? 0);
        } else {
          map.set(sku, {
            sku,
            nombre: movement.productName,
            cantidadVendida: Number(movement.quantity ?? 0),
            ingresoTotal: Number(movement.ingreso_total ?? 0),
            costoTotal: Number(movement.costo_total ?? 0),
            gananciaTotal: Number(movement.ganancia ?? 0),
          });
        }
      });

    return Array.from(map.values());
  }, [movements]);

  const productosMayorGanancia = useMemo(() => {
    return [...productProfitReports]
      .sort((a, b) => b.gananciaTotal - a.gananciaTotal)
      .slice(0, 10);
  }, [productProfitReports]);

  const productosMenorGanancia = useMemo(() => {
    return [...productProfitReports]
      .sort((a, b) => a.gananciaTotal - b.gananciaTotal)
      .slice(0, 10);
  }, [productProfitReports]);

  const renderProfitTable = (
    data: ProductProfitReport[],
    emptyMessage: string,
    type: "best" | "worst"
  ) => {
    if (data.length === 0) {
      return (
        <div className="h-40 flex items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Piezas vendidas</TableHead>
            <TableHead>Ingresos</TableHead>
            <TableHead>Costos</TableHead>
            <TableHead>Ganancia</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((product, index) => (
            <TableRow key={`${type}-${product.sku}`}>
              <TableCell className="font-medium">{index + 1}</TableCell>

              <TableCell>
                <Badge variant="outline">{product.sku}</Badge>
              </TableCell>

              <TableCell className="font-medium">{product.nombre}</TableCell>

              <TableCell>{product.cantidadVendida}</TableCell>

              <TableCell>{money(product.ingresoTotal)}</TableCell>

              <TableCell>{money(product.costoTotal)}</TableCell>

              <TableCell>
                <span
                  className={
                    product.gananciaTotal >= 0
                      ? "font-semibold text-green-600"
                      : "font-semibold text-red-600"
                  }
                >
                  {money(product.gananciaTotal)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Finanzas
          </h1>
          <p className="text-muted-foreground">
            Resumen de ingresos, costos, ganancias y rentabilidad por producto.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Ingresos totales
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-3xl font-bold">{money(resumen.ingresos)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingDown className="h-4 w-4" />
                Costos totales
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-3xl font-bold">{money(resumen.costos)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                {resumen.ganancia >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                Ganancia neta
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p
                className={
                  resumen.ganancia >= 0
                    ? "text-3xl font-bold text-green-600"
                    : "text-3xl font-bold text-red-600"
                }
              >
                {money(resumen.ganancia)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ganancias por fecha</CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={grafica}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />

                <Line
  type="monotone"
  dataKey="ingresos"
  name="Ingresos"
  stroke="hsl(var(--chart-green))"
  strokeWidth={3}
  dot={{ r: 4 }}
/>

<Line
  type="monotone"
  dataKey="costos"
  name="Costos"
  stroke="hsl(var(--chart-red))"
  strokeWidth={3}
  dot={{ r: 4 }}
/>

<Line
  type="monotone"
  dataKey="ganancia"
  name="Ganancia"
  stroke="hsl(var(--chart-blue))"
  strokeWidth={3}
  dot={{ r: 4 }}
/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Productos con mayores ganancias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ranking general por ganancia acumulada en ventas registradas.
              </p>
            </CardHeader>

            <CardContent>
              {renderProfitTable(
                productosMayorGanancia,
                "Todavía no hay ventas registradas para calcular ganancias.",
                "best"
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Productos con menores ganancias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Productos con menor ganancia acumulada. Útil para detectar baja
                rentabilidad o pérdidas.
              </p>
            </CardHeader>

            <CardContent>
              {renderProfitTable(
                productosMenorGanancia,
                "Todavía no hay ventas registradas para calcular ganancias.",
                "worst"
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
