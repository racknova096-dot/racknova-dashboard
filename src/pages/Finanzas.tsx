import React, { useEffect, useState } from "react";
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
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import {
  FinancialChartPoint,
  FinancialSummary,
} from "@/types/finance";

export default function Finanzas() {
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
    }).format(value);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Finanzas
          </h1>
          <p className="text-muted-foreground">
            Resumen de ingresos, costos y ganancias por ventas registradas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Ingresos totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {money(resumen.ingresos)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Costos totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {money(resumen.costos)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                {resumen.ganancia >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                Ganancia neta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
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
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ingresos" name="Ingresos" />
                <Line type="monotone" dataKey="costos" name="Costos" />
                <Line type="monotone" dataKey="ganancia" name="Ganancia" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
