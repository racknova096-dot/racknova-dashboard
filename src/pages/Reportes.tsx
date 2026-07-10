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
  LineChart,
  Line,
  Legend,
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
  DollarSign,
} from "lucide-react";

type PeriodoFiltro = "semana" | "mes" | "anio" | "todo";

type VentaProducto = {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
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
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date =
    value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);

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
          current.ingresoTotal += Number(movement.ingreso_total ?? 0);
          current.costoTotal += Number(movement.costo_total ?? 0);
          current.gananciaTotal += Number(movement.ganancia ?? 0);

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
            ingresoTotal: Number(movement.ingreso_total ?? 0),
            costoTotal: Number(movement.costo_total ?? 0),
            gananciaTotal: Number(movement.ganancia ?? 0),
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
        ingresoTotal: Number(venta?.ingresoTotal ?? 0),
        costoTotal: Number(venta?.costoTotal ?? 0),
        gananciaTotal: Number(venta?.gananciaTotal ?? 0),
      };
    });
  }, [products, ventasMap]);

  const ventasOrdenadas = useMemo(() => {
    return Array.from(ventasMap.values()).sort(
      (a, b) => b.cantidadVendida - a.cantidadVendida
    );
  }, [ventasMap]);

  const productosMasVendidos = ventasOrdenadas.slice(0, 8);

  const productosMenosVendidos = useMemo(() => {
    return [...productosReporte]
      .sort((a, b) => {
        if (a.cantidadVendida !== b.cantidadVendida) {
          return a.cantidadVendida - b.cantidadVendida;
        }

        return b.cantidadActual - a.cantidadActual;
      })
      .slice(0, 8);
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
        ingresos: number;
        costos: number;
        ganancia: number;
        piezasVendidas: number;
        entradas: number;
      }
    >();

    movimientosFiltrados.forEach((movement) => {
      const fecha = new Date(movement.timestamp).toISOString().slice(0, 10);
      const current =
        map.get(fecha) ??
        {
          fecha,
          ingresos: 0,
          costos: 0,
          ganancia: 0,
          piezasVendidas: 0,
          entradas: 0,
        };

      if (movement.action === "Egreso") {
        current.ingresos += Number(movement.ingreso_total ?? 0);
        current.costos += Number(movement.costo_total ?? 0);
        current.ganancia += Number(movement.ganancia ?? 0);
        current.piezasVendidas += Number(movement.quantity ?? 0);
      }

      if (movement.action === "Ingreso") {
        current.entradas += Number(movement.quantity ?? 0);
      }

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
      { estado: "Bajo", productos: bajo },
      { estado: "Normal", productos: normal },
      { estado: "Alto", productos: alto },
    ];
  }, [products]);

  const resumen = useMemo(() => {
    const ventas = movimientosFiltrados.filter(
      (movement) => movement.action === "Egreso"
    );

    const ingresos = ventas.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costos = ventas.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const ganancia = ventas.reduce(
      (total, movement) => total + Number(movement.ganancia ?? 0),
      0
    );

    const piezasVendidas = ventas.reduce(
      (total, movement) => total + Number(movement.quantity ?? 0),
      0
    );

    return {
      ingresos,
      costos,
      ganancia,
      piezasVendidas,
      movimientos: movimientosFiltrados.length,
      productosActivos: products.length,
      stockBajo: productosStockBajo.length,
      stockAlto: productosStockAlto.length,
      porCaducar: productosPorCaducar.length,
      vencidos: productosVencidos.length,
    };
  }, [
    movimientosFiltrados,
    products.length,
    productosStockBajo.length,
    productosStockAlto.length,
    productosPorCaducar.length,
    productosVencidos.length,
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
      "Ingresos",
      "Costos",
      "Ganancia",
      "Caducidad",
      "Dias caducidad",
    ];

    const rows = productosReporte.map((product) => [
      product.sku,
      product.nombre,
      product.locationId,
      product.cantidadActual,
      product.stockMinimo,
      product.stockAlto,
      product.cantidadVendida,
      product.ingresoTotal,
      product.costoTotal,
      product.gananciaTotal,
      product.caducidad ?? "",
      product.diasCaducidad ?? "",
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
            Gráficas y tablas de ventas, stock, caducidad y movimientos.
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
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos</p>
                <p className="text-3xl font-bold">
                  {money(resumen.ingresos)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ganancia</p>
                <p
                  className={`text-3xl font-bold ${
                    resumen.ganancia >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {money(resumen.ganancia)}
                </p>
              </div>
              {resumen.ganancia >= 0 ? (
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sku" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidadVendida" name="Vendidas" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Ventas y ganancias por fecha</CardTitle>
          </CardHeader>

          <CardContent className="h-[320px]">
            {movimientosPorFecha.length === 0 ? (
              <EmptyState text="No hay movimientos financieros en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movimientosPorFecha}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="ganancia"
                    name="Ganancia"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Distribución de stock</CardTitle>
          </CardHeader>

          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="estado" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="productos" name="Productos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Movimientos por fecha</CardTitle>
          </CardHeader>

          <CardContent className="h-[280px]">
            {movimientosPorFecha.length === 0 ? (
              <EmptyState text="No hay movimientos en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movimientosPorFecha}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="piezasVendidas" name="Piezas vendidas" />
                  <Bar dataKey="entradas" name="Piezas ingresadas" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
                      <TableHead>Ingresos</TableHead>
                      <TableHead>Ganancia</TableHead>
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
                        <TableCell>{product.cantidadVendida}</TableCell>
                        <TableCell>{money(product.ingresoTotal)}</TableCell>
                        <TableCell
                          className={
                            product.gananciaTotal >= 0
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {money(product.gananciaTotal)}
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
              <TrendingDown className="h-5 w-5" />
              Menos vendidos / sin venta
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosMenosVendidos.length === 0 ? (
              <EmptyState text="No hay productos para analizar." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Stock actual</TableHead>
                      <TableHead>Vendidas</TableHead>
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
                        <TableCell>{product.cantidadActual}</TableCell>
                        <TableCell>
                          {product.cantidadVendida === 0 ? (
                            <Badge variant="outline">Sin venta</Badge>
                          ) : (
                            product.cantidadVendida
                          )}
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
                            ? `${Math.abs(product.diasCaducidad)} día(s) vencido`
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
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Ganancia</TableHead>
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
                        <TableCell>
                          {money(Number(movement.ingreso_total ?? 0))}
                        </TableCell>
                        <TableCell>
                          {money(Number(movement.costo_total ?? 0))}
                        </TableCell>
                        <TableCell
                          className={
                            Number(movement.ganancia ?? 0) >= 0
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {money(Number(movement.ganancia ?? 0))}
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
