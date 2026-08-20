import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BarChart3, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory } from "@/context/InventoryContext";

type TimeFilter = "7days" | "30days" | "90days";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatDay = (value: Date) =>
  value.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });

const getDays = (filter: TimeFilter) =>
  filter === "7days" ? 7 : filter === "30days" ? 30 : 90;

const getFilterLabel = (filter: TimeFilter) =>
  filter === "7days"
    ? "Últimos 7 días"
    : filter === "30days"
      ? "Últimos 30 días"
      : "Últimos 90 días";

const axisTick = {
  fontSize: 11,
};

export function RealTimeCharts() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7days");
  const { movements } = useInventory();

  const dailyData = useMemo(() => {
    const days = getDays(timeFilter);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - index));

      const dayMovements = movements.filter((movement) => {
        const movementDate = toDate(movement.timestamp);

        return (
          movementDate.getFullYear() === date.getFullYear() &&
          movementDate.getMonth() === date.getMonth() &&
          movementDate.getDate() === date.getDate()
        );
      });

      const sales = dayMovements.filter(
        (movement) => movement.action === "Egreso"
      );

      return {
        date: formatDay(date),
        ventas: sales.reduce(
          (total, movement) => total + Number(movement.ingreso_total ?? 0),
          0
        ),
        ganancia: sales.reduce(
          (total, movement) => total + Number(movement.ganancia ?? 0),
          0
        ),
        unidades: sales.reduce(
          (total, movement) => total + Number(movement.quantity ?? 0),
          0
        ),
      };
    });
  }, [movements, timeFilter]);

  const periodTotals = useMemo(
    () =>
      dailyData.reduce(
        (totals, day) => ({
          ventas: totals.ventas + day.ventas,
          ganancia: totals.ganancia + day.ganancia,
          unidades: totals.unidades + day.unidades,
        }),
        { ventas: 0, ganancia: 0, unidades: 0 }
      ),
    [dailyData]
  );

  const topProducts = useMemo(() => {
    const days = getDays(timeFilter);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - days);

    const sales = new Map<
      string,
      { sku: string; name: string; quantity: number }
    >();

    movements
      .filter(
        (movement) =>
          movement.action === "Egreso" &&
          toDate(movement.timestamp).getTime() >= from.getTime()
      )
      .forEach((movement) => {
        const current = sales.get(movement.productSku) ?? {
          sku: movement.productSku,
          name: movement.productName,
          quantity: 0,
        };

        current.quantity += Number(movement.quantity ?? 0);
        sales.set(movement.productSku, current);
      });

    return Array.from(sales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        shortName:
          item.name.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
      }));
  }, [movements, timeFilter]);

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.12)",
  };

  return (
    <Card className="racknova-card overflow-hidden rounded-2xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rendimiento comercial
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Ventas, utilidad y rotación en {getFilterLabel(timeFilter).toLowerCase()}.
            </p>
          </div>

          <Select
            value={timeFilter}
            onValueChange={(value) => setTimeFilter(value as TimeFilter)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Últimos 7 días</SelectItem>
              <SelectItem value="30days">Últimos 30 días</SelectItem>
              <SelectItem value="90days">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Ventas del periodo
            </p>
            <p className="mt-1 text-lg font-black">
              {money(periodTotals.ventas)}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Ganancia
            </p>
            <p
              className={`mt-1 text-lg font-black ${
                periodTotals.ganancia >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {money(periodTotals.ganancia)}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Unidades vendidas
            </p>
            <p className="mt-1 text-lg font-black">
              {periodTotals.unidades.toLocaleString("es-MX")}
            </p>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dailyData}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-blue))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-blue))"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-green))"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-green))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(value) =>
                  Number(value) >= 1000
                    ? `${Math.round(Number(value) / 1000)}k`
                    : String(value)
                }
              />

              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [
                  money(Number(value)),
                  name === "ventas" ? "Ventas" : "Ganancia",
                ]}
              />

              <Area
                type="monotone"
                dataKey="ventas"
                stroke="hsl(var(--chart-blue))"
                strokeWidth={2.5}
                fill="url(#salesArea)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="ganancia"
                stroke="hsl(var(--chart-green))"
                strokeWidth={2}
                fill="url(#profitArea)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t border-border/60 pt-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">Productos más vendidos</p>
          </div>

          {topProducts.length === 0 ? (
            <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
              No hay ventas registradas en este periodo.
            </div>
          ) : (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={115}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [
                      `${Number(value).toLocaleString("es-MX")} uds.`,
                      "Vendidas",
                    ]}
                  />
                  <Bar
                    dataKey="quantity"
                    fill="hsl(var(--chart-cyan))"
                    radius={[0, 8, 8, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
