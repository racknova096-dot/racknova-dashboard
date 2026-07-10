import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Boxes,
  PackageCheck,
  CalendarClock,
  Download,
  Activity,
  PackageX,
  ShoppingCart,
} from "lucide-react";

type PeriodoFiltro = "semana" | "mes" | "anio" | "todo";

type VentaProducto = {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  primeraVenta: Date | null;
  ultimaVenta: Date | null;
};

type ProductoReporte = {
  sku: string;
  nombre: string;
  locationId: string;
  cantidadActual: number;
  stockMinimo: number;
  stockAlto: number;
  caducidad: string | null;
  diasCaducidad: number | null;
  cantidadVendida: number;
  ultimaVenta: Date | null;
};

const CHART_COLORS = {
  primary: "#2563eb",
  emerald: "#059669",
  amber: "#f59e0b",
  red: "#dc2626",
  purple: "#7c3aed",
  cyan: "#06b6d4",
  notSold: "#0ea5e9",
};

const STOCK_COLORS = ["#dc2626", "#2563eb", "#059669"];

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  color: "#0f172a",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
};

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};

const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 600,
};

function numberFormat(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDaysToExpiration(dateValue?: string | null) {
  if (!dateValue) return null;

  const cleanDate = dateValue.slice(0, 10);
  const expirationDate = new Date(`${cleanDate}T00:00:00`);

  const today = new Date();
  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs = expirationDate.getTime() - todayClean.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isMovementInsidePeriod(date: Date, periodo: PeriodoFiltro) {
  if (periodo === "todo") return true;

  const now = new Date();
  const current = new Date(date);

  if (periodo === "semana") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return current >= sevenDaysAgo;
  }

  if (periodo === "mes") {
    return (
      current.getFullYear() === now.getFullYear() &&
      current.getMonth() === now.getMonth()
    );
  }

  if (periodo === "anio") {
    return current.getFullYear() === now.getFullYear();
  }

  return true;
}

function getPeriodoLabel(periodo: PeriodoFiltro) {
  if (periodo === "semana") return "Últimos 7 días";
  if (periodo === "mes") return "Mes actual";
  if (periodo === "anio") return "Año actual";
  return "Todo el historial";
}

function getStockStatus(product: Product) {
  const stockMinimo = Number(product.stock_minimo ?? 10);
  const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);

  if (product.cantidad <= stockMinimo) return "bajo";
  if (product.cantidad >= stockAlto) return "alto";

  return "normal";
}

function StockBadge({ product }: { product: Product }) {
  const status = getStockStatus(product);

  if (status === "bajo") {
    return <Badge variant="destructive">Stock bajo</Badge>;
  }

  if (status === "alto") {
    return <Badge className="bg-blue-600 hover:bg-blue-600">Stock alto</Badge>;
  }

  return <Badge variant="outline">Stock normal</Badge>;
}

function ExpirationBadge({ days }: { days: number | null }) {
  if (days === null) return <Badge variant="outline">Sin caducidad</Badge>;

  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;

  if (days === 0) {
    return <Badge className="bg-red-600 hover:bg-red-600">Caduca hoy</Badge>;
  }

  if (days <= 30) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500">
        Caduca en {days} día(s)
      </Badge>
    );
  }

  return <Badge variant="outline">Vigente</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function tooltipProductName(_label: unknown, payload: any[]) {
  const item = payload?.[0]?.payload;

  return item?.nombre || "Producto";
}

export default function Reportes() {
  const { products, movements } = useInventory();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");

  const movimientosFiltrados = useMemo(() => {
    return movements.filter((movement) =>
      isMovementInsidePeriod(new Date(movement.timestamp), periodo)
    );
  }, [movements, periodo]);

  const ventasMap = useMemo(() => {
    const map = new Map<string, VentaProducto>();

    movimientosFiltrados
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const sku = movement.productSku;
        const fecha = new Date(movement.timestamp);

        const current = map.get(sku);

        if (current) {
          current.cantidadVendida += Number(movement.quantity ?? 0);

          if (!current.primeraVenta || fecha < current.primeraVenta) {
            current.primeraVenta = fecha;
          }

          if (!current.ultimaVenta || fecha > current.ultimaVenta) {
            current.ultimaVenta = fecha;
          }
        } else {
          map.set(sku, {
            sku,
            nombre: movement.productName,
            cantidadVendida: Number(movement.quantity ?? 0),
            primeraVenta: fecha,
            ultimaVenta: fecha,
          });
        }
      });

    return map;
  }, [movimientosFiltrados]);

  const productosReporte: ProductoReporte[] = useMemo(() => {
    return products.map((product) => {
      const venta = ventasMap.get(product.sku);
      const stockMinimo = Number(product.stock_minimo ?? 10);
      const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);
      const caducidad = product.caducidad ?? null;
      const diasCaducidad = getDaysToExpiration(caducidad);

      return {
        sku: product.sku,
        nombre: product.nombre,
        locationId: product.locationId,
        cantidadActual: product.cantidad,
        stockMinimo,
        stockAlto,
        caducidad,
        diasCaducidad,
        cantidadVendida: Number(venta?.cantidadVendida ?? 0),
        ultimaVenta: venta?.ultimaVenta ?? null,
      };
    });
  }, [products, ventasMap]);

  const productosMasVendidos = useMemo(() => {
    return Array.from(ventasMap.values())
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 8);
  }, [ventasMap]);

  const productosMenosVendidos = useMemo(() => {
    return productosReporte
      .filter((product) => product.cantidadVendida > 0)
      .sort((a, b) => a.cantidadVendida - b.cantidadVendida)
      .slice(0, 8);
  }, [productosReporte]);

  const productosNoVendidos = useMemo(() => {
    return productosReporte
      .filter((product) => product.cantidadVendida === 0)
      .sort((a, b) => b.cantidadActual - a.cantidadActual);
  }, [productosReporte]);

  const productosStockBajo = useMemo(() => {
    return products
      .filter((product) => getStockStatus(product) === "bajo")
      .sort((a, b) => a.cantidad - b.cantidad);
  }, [products]);

  const productosStockAlto = useMemo(() => {
    return products
      .filter((product) => getStockStatus(product) === "alto")
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [products]);

  const productosCaducidad = useMemo(() => {
    return productosReporte
      .filter((product) => product.caducidad)
      .sort((a, b) => {
        const aDays = a.diasCaducidad ?? 999999;
        const bDays = b.diasCaducidad ?? 999999;

        return aDays - bDays;
      });
  }, [productosReporte]);

  const productosPorCaducar = productosCaducidad.filter(
    (product) =>
      product.diasCaducidad !== null &&
      product.diasCaducidad >= 0 &&
      product.diasCaducidad <= 30
  );

  const productosVencidos = productosCaducidad.filter(
    (product) => product.diasCaducidad !== null && product.diasCaducidad < 0
  );

  const movimientosPorFecha = useMemo(() => {
    const map = new Map<
      string,
      {
        fecha: string;
        piezasVendidas: number;
        piezasIngresadas: number;
        movimientos: number;
      }
    >();

    movimientosFiltrados.forEach((movement) => {
      const fecha = new Date(movement.timestamp).toISOString().slice(0, 10);
      const current =
        map.get(fecha) ??
        {
          fecha,
          piezasVendidas: 0,
          piezasIngresadas: 0,
          movimientos: 0,
        };

      if (movement.action === "Egreso") {
        current.piezasVendidas += Number(movement.quantity ?? 0);
      }

      if (movement.action === "Ingreso") {
        current.piezasIngresadas += Number(movement.quantity ?? 0);
      }

      current.movimientos += 1;

      map.set(fecha, current);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    );
  }, [movimientosFiltrados]);

  const stockChartData = useMemo(() => {
    const bajo = products.filter((product) => getStockStatus(product) === "bajo")
      .length;
    const normal = products.filter(
      (product) => getStockStatus(product) === "normal"
    ).length;
    const alto = products.filter((product) => getStockStatus(product) === "alto")
      .length;

    return [
      { estado: "Stock bajo", productos: bajo },
      { estado: "Stock normal", productos: normal },
      { estado: "Stock alto", productos: alto },
    ];
  }, [products]);

  const resumen = useMemo(() => {
    const ventas = movimientosFiltrados.filter(
      (movement) => movement.action === "Egreso"
    );

    const piezasVendidas = ventas.reduce(
      (total, movement) => total + Number(movement.quantity ?? 0),
      0
    );

    return {
      piezasVendidas,
      movimientos: movimientosFiltrados.length,
      productosActivos: products.length,
      stockBajo: productosStockBajo.length,
      stockAlto: productosStockAlto.length,
      porCaducar: productosPorCaducar.length,
      vencidos: productosVencidos.length,
      noVendidos: productosNoVendidos.length,
    };
  }, [
    movimientosFiltrados,
    products.length,
    productosStockBajo.length,
    productosStockAlto.length,
    productosPorCaducar.length,
    productosVencidos.length,
    productosNoVendidos.length,
  ]);

  const exportCSV = () => {
    const headers = [
      "SKU",
      "Producto",
      "Ubicacion",
      "Cantidad actual",
      "Stock minimo",
      "Stock alto",
      "Cantidad vendida",
      "Caducidad",
      "Dias caducidad",
      "Ultima venta",
    ];

    const rows = productosReporte.map((product) => [
      product.sku,
      product.nombre,
      product.locationId,
      product.cantidadActual,
      product.stockMinimo,
      product.stockAlto,
      product.cantidadVendida,
      product.caducidad ?? "",
      product.diasCaducidad ?? "",
      product.ultimaVenta ? formatDate(product.ultimaVenta) : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `racknova-reportes-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="racknova-page-title flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Reportes
          </h1>
          <p className="text-muted-foreground">
            Análisis operativo de ventas, rotación, stock, caducidad y
            movimientos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={periodo}
            onValueChange={(value) => setPeriodo(value as PeriodoFiltro)}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="semana">Últimos 7 días</SelectItem>
              <SelectItem value="mes">Mes actual</SelectItem>
              <SelectItem value="anio">Año actual</SelectItem>
              <SelectItem value="todo">Todo el historial</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="text-base">
            Periodo seleccionado: {getPeriodoLabel(periodo)}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Piezas vendidas
                </p>
                <p className="text-3xl font-bold">{resumen.piezasVendidas}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos activos
                </p>
                <p className="text-3xl font-bold">
                  {resumen.productosActivos}
                </p>
              </div>
              <Boxes className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos sin venta
                </p>
                <p className="text-3xl font-bold text-sky-600">
                  {resumen.noVendidos}
                </p>
              </div>
              <PackageX className="h-8 w-8 text-sky-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Movimientos</p>
                <p className="text-3xl font-bold">{resumen.movimientos}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Stock bajo</p>
            <p className="text-3xl font-bold text-red-600">
              {resumen.stockBajo}
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Stock alto</p>
            <p className="text-3xl font-bold text-blue-600">
              {resumen.stockAlto}
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Por caducar</p>
            <p className="text-3xl font-bold text-amber-600">
              {resumen.porCaducar}
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Vencidos</p>
            <p className="text-3xl font-bold text-red-600">
              {resumen.vencidos}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>

          <CardContent className="h-[320px]">
            {productosMasVendidos.length === 0 ? (
              <EmptyState text="No hay ventas registradas en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productosMasVendidos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="sku"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={tooltipProductName}
                    formatter={(value) => [
                      `${numberFormat(Number(value))} pieza(s)`,
                      "Vendidas",
                    ]}
                  />
                  <Bar
                    dataKey="cantidadVendida"
                    name="Vendidas"
                    fill={CHART_COLORS.emerald}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Productos menos vendidos</CardTitle>
          </CardHeader>

          <CardContent className="h-[320px]">
            {productosMenosVendidos.length === 0 ? (
              <EmptyState text="No hay productos con ventas bajas en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productosMenosVendidos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="sku"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={tooltipProductName}
                    formatter={(value) => [
                      `${numberFormat(Number(value))} pieza(s)`,
                      "Vendidas",
                    ]}
                  />
                  <Bar
                    dataKey="cantidadVendida"
                    name="Vendidas"
                    fill={CHART_COLORS.amber}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Productos no vendidos</CardTitle>
          </CardHeader>

          <CardContent className="h-[320px]">
            {productosNoVendidos.length === 0 ? (
              <EmptyState text="Todos los productos actuales tuvieron venta en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productosNoVendidos.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="sku"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={tooltipProductName}
                    formatter={(value) => [
                      `${numberFormat(Number(value))} pieza(s)`,
                      "Stock actual",
                    ]}
                  />
                  <Bar
                    dataKey="cantidadActual"
                    name="Stock actual"
                    fill={CHART_COLORS.notSold}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Distribución de stock</CardTitle>
          </CardHeader>

          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockChartData}
                  dataKey="productos"
                  nameKey="estado"
                  outerRadius={105}
                  innerRadius={55}
                  paddingAngle={4}
                  label
                >
                  {stockChartData.map((_, index) => (
                    <Cell
                      key={`stock-cell-${index}`}
                      fill={STOCK_COLORS[index % STOCK_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle>Movimientos por fecha</CardTitle>
        </CardHeader>

        <CardContent className="h-[300px]">
          {movimientosPorFecha.length === 0 ? (
            <EmptyState text="No hay movimientos en este periodo." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movimientosPorFecha}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="fecha"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8" }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Legend />
                <Bar
                  dataKey="piezasVendidas"
                  name="Piezas vendidas"
                  fill={CHART_COLORS.primary}
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="piezasIngresadas"
                  name="Piezas ingresadas"
                  fill={CHART_COLORS.purple}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top productos más vendidos
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosMasVendidos.length === 0 ? (
              <EmptyState text="No hay productos vendidos en este periodo." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Vendidas</TableHead>
                      <TableHead>Última venta</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosMasVendidos.map((product, index) => (
                      <TableRow key={product.sku}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.nombre}</TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {product.cantidadVendida}
                        </TableCell>
                        <TableCell>{formatDate(product.ultimaVenta)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Productos menos vendidos
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosMenosVendidos.length === 0 ? (
              <EmptyState text="No hay productos con ventas bajas en este periodo." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Vendidas</TableHead>
                      <TableHead>Stock actual</TableHead>
                      <TableHead>Ubicación</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosMenosVendidos.map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell className="font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.nombre}</TableCell>
                        <TableCell className="font-semibold text-amber-600">
                          {product.cantidadVendida}
                        </TableCell>
                        <TableCell>{product.cantidadActual}</TableCell>
                        <TableCell className="font-mono">
                          {product.locationId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Productos no vendidos
          </CardTitle>
        </CardHeader>

        <CardContent>
          {productosNoVendidos.length === 0 ? (
            <EmptyState text="Todos los productos activos tuvieron venta en este periodo." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="racknova-table-header">
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Stock actual</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Caducidad</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {productosNoVendidos.slice(0, 20).map((product) => {
                    const original = products.find((p) => p.sku === product.sku);

                    return (
                      <TableRow key={product.sku}>
                        <TableCell className="font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.nombre}</TableCell>
                        <TableCell className="font-semibold">
                          {product.cantidadActual}
                        </TableCell>
                        <TableCell>
                          {original ? (
                            <StockBadge product={original} />
                          ) : (
                            <Badge variant="outline">-</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {product.locationId}
                        </TableCell>
                        <TableCell>
                          <ExpirationBadge days={product.diasCaducidad} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {productosNoVendidos.length > 20 && (
                <p className="text-xs text-muted-foreground p-3">
                  Mostrando 20 de {productosNoVendidos.length} productos sin
                  venta.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Stock bajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosStockBajo.length === 0 ? (
              <EmptyState text="No hay productos con stock bajo." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Mínimo</TableHead>
                      <TableHead>Ubicación</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosStockBajo.map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell className="font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.nombre}</TableCell>
                        <TableCell className="font-semibold text-red-600">
                          {product.cantidad}
                        </TableCell>
                        <TableCell>{product.stock_minimo ?? 10}</TableCell>
                        <TableCell className="font-mono">
                          {product.locationId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Stock alto
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosStockAlto.length === 0 ? (
              <EmptyState text="No hay productos con stock alto." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock alto</TableHead>
                      <TableHead>Ubicación</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosStockAlto.map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell className="font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.nombre}</TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {product.cantidad}
                        </TableCell>
                        <TableCell>
                          {product.stock_alto ??
                            Number(product.stock_minimo ?? 10) * 3}
                        </TableCell>
                        <TableCell className="font-mono">
                          {product.locationId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Caducidades
          </CardTitle>
        </CardHeader>

        <CardContent>
          {productosCaducidad.length === 0 ? (
            <EmptyState text="No hay productos con caducidad registrada." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="racknova-table-header">
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Caducidad próxima</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {productosCaducidad.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        <ExpirationBadge days={product.diasCaducidad} />
                      </TableCell>
                      <TableCell className="font-mono">{product.sku}</TableCell>
                      <TableCell>{product.nombre}</TableCell>
                      <TableCell>{product.cantidadActual}</TableCell>
                      <TableCell>{formatDate(product.caducidad)}</TableCell>
                      <TableCell>
                        {product.diasCaducidad !== null
                          ? product.diasCaducidad < 0
                            ? `${Math.abs(
                                product.diasCaducidad
                              )} día(s) vencido`
                            : `${product.diasCaducidad} día(s)`
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {product.locationId}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de movimientos
          </CardTitle>
        </CardHeader>

        <CardContent>
          {movimientosFiltrados.length === 0 ? (
            <EmptyState text="No hay movimientos en este periodo." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="racknova-table-header">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {[...movimientosFiltrados]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .slice(0, 50)
                    .map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{formatDate(movement.timestamp)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              movement.action === "Egreso"
                                ? "destructive"
                                : movement.action === "Ingreso"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {movement.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {movement.productSku}
                        </TableCell>
                        <TableCell>{movement.productName}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="font-mono">
                          {movement.location}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {movimientosFiltrados.length > 50 && (
            <p className="text-xs text-muted-foreground mt-3">
              Mostrando los 50 movimientos más recientes del periodo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
