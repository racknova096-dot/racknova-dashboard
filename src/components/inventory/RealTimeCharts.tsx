import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Boxes,
  PieChart as PieChartIcon,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  }).format(Number(value || 0));

const toDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatDay = (value: Date) => {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
};

const isInsideTimeFilter = (value: string | Date, filter: TimeFilter) => {
  const date = toDate(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const from = new Date(today);

  if (filter === "7days") {
    from.setDate(today.getDate() - 7);
  }

  if (filter === "30days") {
    from.setDate(today.getDate() - 30);
  }

  if (filter === "90days") {
    from.setDate(today.getDate() - 90);
  }

  from.setHours(0, 0, 0, 0);

  return date >= from && date <= today;
};

const getTimeFilterLabel = (filter: TimeFilter) => {
  if (filter === "7days") return "Últimos 7 días";
  if (filter === "30days") return "Últimos 30 días";
  return "Últimos 90 días";
};

export function RealTimeCharts() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7days");

  const { locations, products, movements } = useInventory();

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) =>
      isInsideTimeFilter(movement.timestamp, timeFilter)
    );
  }, [movements, timeFilter]);

  const rackOccupationData = useMemo(() => {
    const racks = ["A", "B", "C", "D", "E"];

    return racks.map((rack) => {
      const rackLocations = locations.filter((location) => location.rack === rack);

      const occupiedSlots = rackLocations.filter((location) =>
        products.some((product) => product.locationId === location.id)
      ).length;

      const freeSlots = rackLocations.length - occupiedSlots;

      const percentage =
        rackLocations.length > 0
          ? Math.round((occupiedSlots / rackLocations.length) * 100)
          : 0;

      return {
        name: `Rack ${rack}`,
        occupied: occupiedSlots,
        free: freeSlots,
        percentage,
      };
    });
  }, [locations, products]);

  const movementData = useMemo(() => {
    const days =
      timeFilter === "7days" ? 7 : timeFilter === "30days" ? 30 : 90;

    const today = new Date();

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

      const ingresos = dayMovements
        .filter((movement) => movement.action === "Ingreso")
        .reduce((total, movement) => total + Number(movement.quantity ?? 0), 0);

      const egresos = dayMovements
        .filter((movement) => movement.action === "Egreso")
        .reduce((total, movement) => total + Number(movement.quantity ?? 0), 0);

      return {
        date: formatDay(date),
        ingresos,
        egresos,
        total: ingresos + egresos,
      };
    });
  }, [movements, timeFilter]);

  const topSoldProductsData = useMemo(() => {
    const productSales = new Map<
      string,
      {
        name: string;
        sku: string;
        quantity: number;
        income: number;
        profit: number;
        movements: number;
      }
    >();

    filteredMovements
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const key = movement.productSku;

        const current = productSales.get(key) ?? {
          name: movement.productName,
          sku: movement.productSku,
          quantity: 0,
          income: 0,
          profit: 0,
          movements: 0,
        };

        current.quantity += Number(movement.quantity ?? 0);
        current.income += Number(movement.ingreso_total ?? 0);
        current.profit += Number(movement.ganancia ?? 0);
        current.movements += 1;

        productSales.set(key, current);
      });

    return Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        shortName:
          item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name,
      }));
  }, [filteredMovements]);

  const overallOccupationData = useMemo(() => {
    const totalSlots = locations.length;

    const occupiedSlots = locations.filter((location) =>
      products.some((product) => product.locationId === location.id)
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

  const totalSoldPieces = topSoldProductsData.reduce(
    (total, product) => total + product.quantity,
    0
  );

  const totalSoldIncome = topSoldProductsData.reduce(
    (total, product) => total + product.income,
    0
  );

  const totalSoldProfit = topSoldProductsData.reduce(
    (total, product) => total + product.profit,
    0
  );

  const COLORS = {
    occupied: "hsl(var(--slot-occupied))",
    free: "hsl(var(--slot-free))",
    ingresos: "hsl(var(--slot-free))",
    egresos: "hsl(var(--slot-occupied))",
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    warning: "hsl(var(--warning))",
    profit: "hsl(var(--profit))",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="mb-2 font-semibold">{label}</p>

        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm">
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const SalesTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-semibold">{data.name}</p>
        <p className="text-xs text-muted-foreground">SKU: {data.sku}</p>

        <div className="mt-2 space-y-1 text-sm">
          <p>Piezas vendidas: {data.quantity}</p>
          <p>Ingreso total: {money(data.income)}</p>
          <p>Ganancia: {money(data.profit)}</p>
          <p>Movimientos de salida: {data.movements}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Análisis de Inventario en Tiempo Real
          </h2>

          <p className="text-sm text-muted-foreground">
            Visualiza ocupación, movimientos y productos con mayor salida.
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={timeFilter}
            onValueChange={(value) => setTimeFilter(value as TimeFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="7days">Últimos 7 días</SelectItem>
              <SelectItem value="30days">Últimos 30 días</SelectItem>
              <SelectItem value="90days">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Ocupación General de Slots
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overallOccupationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {overallOccupationData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;

                      const data = payload[0].payload;
                      const total = overallOccupationData.reduce(
                        (sum, item) => sum + item.value,
                        0
                      );

                      const percentage =
                        total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;

                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm">
                            {data.value} slots ({percentage}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex justify-center gap-6">
              {overallOccupationData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Ocupación por Rack
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rackOccupationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="occupied"
                    name="Ocupados"
                    stackId="rack"
                    fill={COLORS.occupied}
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="free"
                    name="Libres"
                    stackId="rack"
                    fill={COLORS.free}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {rackOccupationData.map((rack) => (
                <div
                  key={rack.name}
                  className="rounded-lg border bg-muted/30 p-3 text-center"
                >
                  <p className="text-sm font-medium">{rack.name}</p>
                  <p className="text-lg font-bold">{rack.percentage}%</p>
                  <p className="text-xs text-muted-foreground">
                    {rack.occupied} ocupados
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Movimientos por Día
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Periodo: {getTimeFilterLabel(timeFilter)}
            </p>
          </CardHeader>

          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    name="Piezas ingresadas"
                    stroke={COLORS.ingresos}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="egresos"
                    name="Piezas egresadas"
                    stroke={COLORS.egresos}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Top 5 Productos por Piezas Vendidas
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Solo considera salidas tipo Egreso en{" "}
              {getTimeFilterLabel(timeFilter).toLowerCase()}.
            </p>
          </CardHeader>

          <CardContent>
            {topSoldProductsData.length === 0 ? (
              <div className="flex h-80 items-center justify-center rounded-xl border bg-muted/30 text-center text-muted-foreground">
                No hay ventas registradas en este periodo.
              </div>
            ) : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Piezas vendidas
                    </p>
                    <p className="text-xl font-bold">{totalSoldPieces}</p>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Ingreso top 5
                    </p>
                    <p className="text-xl font-bold">
                      {money(totalSoldIncome)}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Ganancia top 5
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        totalSoldProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {money(totalSoldProfit)}
                    </p>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topSoldProductsData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="shortName"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<SalesTooltip />} />
                      <Bar
                        dataKey="quantity"
                        name="Piezas vendidas"
                        fill={COLORS.primary}
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
