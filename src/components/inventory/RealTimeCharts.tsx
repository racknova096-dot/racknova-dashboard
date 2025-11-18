//modificacion inicia
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory } from "@/context/InventoryContext";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from "lucide-react";

export function RealTimeCharts() {
  const [timeFilter, setTimeFilter] = useState<"7days" | "30days" | "90days">(
    "7days"
  );

  // 👇 Ahora tomamos 'movements' directamente del contexto
  const { locations, products, movements } = useInventory();

  // Datos para gráfica de ocupación de racks
  const rackOccupationData = useMemo(() => {
    const racks = ["A", "B", "C", "D", "E"];
    return racks.map((rack) => {
      const rackLocations = locations.filter((loc) => loc.rack === rack);
      const occupiedSlots = rackLocations.filter((loc) =>
        products.some((product) => product.locationId === loc.id)
      ).length;
      const freeSlots = rackLocations.length - occupiedSlots;
      const percentage =
        rackLocations.length > 0
          ? (occupiedSlots / rackLocations.length) * 100
          : 0;

      return {
        name: `Rack ${rack}`,
        occupied: occupiedSlots,
        free: freeSlots,
        percentage: Math.round(percentage),
      };
    });
  }, [locations, products]);

  // ✅ Movimientos por día (se actualiza con cada cambio en movements)
  const movementData = useMemo(() => {
    const days = timeFilter === "7days" ? 7 : timeFilter === "30days" ? 30 : 90;
    const today = new Date();
    const dailyData = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      });

      const dayMovements = movements.filter(
        (movement) =>
          new Date(movement.timestamp).toDateString() === date.toDateString()
      );

      const ingresos = dayMovements.filter(
        (m) => m.action === "Ingreso"
      ).length;
      const egresos = dayMovements.filter((m) => m.action === "Egreso").length;

      dailyData.push({
        date: dateStr,
        ingresos,
        egresos,
        total: ingresos + egresos,
      });
    }

    return dailyData;
  }, [movements, timeFilter]);

  // ✅ Top 5 productos más movidos (también depende de movements)
  const topProductsData = useMemo(() => {
    const productMovements = new Map<
      string,
      { name: string; count: number; sku: string }
    >();

    movements.forEach((movement) => {
      const key = movement.productSku;
      if (productMovements.has(key)) {
        const existing = productMovements.get(key)!;
        productMovements.set(key, {
          ...existing,
          count: existing.count + 1,
        });
      } else {
        productMovements.set(key, {
          name: movement.productName,
          sku: movement.productSku,
          count: 1,
        });
      }
    });

    return Array.from(productMovements.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [movements]);

  // Gráfica de dona (ocupación general)
  const overallOccupationData = useMemo(() => {
    const totalSlots = locations.length;
    const occupiedSlots = locations.filter((loc) =>
      products.some((product) => product.locationId === loc.id)
    ).length;
    const freeSlots = totalSlots - occupiedSlots;

    return [
      {
        name: "Ocupados",
        value: occupiedSlots,
        color: "hsl(var(--slot-occupied))",
      },
      {
        name: "Libres",
        value: freeSlots,
        color: "hsl(var(--slot-free))",
      },
    ];
  }, [locations, products]);

  const COLORS = {
    occupied: "hsl(var(--slot-occupied))",
    free: "hsl(var(--slot-free))",
    ingresos: "hsl(var(--slot-free))",
    egresos: "hsl(var(--slot-occupied))",
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">
          Análisis de Inventario en Tiempo Real
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ocupación general */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Ocupación General de Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overallOccupationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {overallOccupationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const total = overallOccupationData.reduce(
                          (sum, item) => sum + item.value,
                          0
                        );
                        const percentage = ((data.value / total) * 100).toFixed(
                          1
                        );
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data.name}</p>
                            <p style={{ color: data.color }}>
                              {data.value} slots ({percentage}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {overallOccupationData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ocupación por Rack */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Ocupación por Rack (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rackOccupationData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip content={CustomTooltip} />
                  <Bar
                    dataKey="percentage"
                    fill={COLORS.primary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Movimientos por Día */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Movimientos por Día
            </CardTitle>
            <Select
              value={timeFilter}
              onValueChange={(value: any) => setTimeFilter(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">7 días</SelectItem>
                <SelectItem value="30days">30 días</SelectItem>
                <SelectItem value="90days">90 días</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip content={CustomTooltip} />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    stroke={COLORS.ingresos}
                    strokeWidth={2}
                    dot={{
                      fill: COLORS.ingresos,
                      strokeWidth: 2,
                      r: 4,
                    }}
                    name="Ingresos"
                  />
                  <Line
                    type="monotone"
                    dataKey="egresos"
                    stroke={COLORS.egresos}
                    strokeWidth={2}
                    dot={{
                      fill: COLORS.egresos,
                      strokeWidth: 2,
                      r: 4,
                    }}
                    name="Egresos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Productos Más Movidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Top 5 Productos Más Movidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="horizontal">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {data.sku}
                            </p>
                            <p style={{ color: payload[0].color }}>
                              Movimientos: {data.count}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={COLORS.accent}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
//modificacion cierra
