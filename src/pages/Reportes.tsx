import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  AlertTriangle,
  Boxes,
  PackageCheck,
} from "lucide-react";

type VentaProducto = {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ingresoTotal: number;
  gananciaTotal: number;
};

type CaducidadProducto = {
  sku: string;
  nombre: string;
  cantidad: number;
  caducidad: string;
  diasRestantes: number;
};

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#be185d",
];

function getStockMinimo(product: Product) {
  return Number((product as any).stock_minimo ?? 10);
}

function getCaducidad(product: Product) {
  return ((product as any).caducidad ?? null) as string | null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function formatDate(dateValue: string) {
  const cleanDate = dateValue.slice(0, 10);
  const date = new Date(`${cleanDate}T00:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDaysToExpiration(dateValue: string) {
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

function ExpirationBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge variant="destructive">Vencido</Badge>;
  }

  if (days === 0) {
    return <Badge variant="destructive">Caduca hoy</Badge>;
  }

  if (days <= 7) {
    return <Badge variant="destructive">Urgente</Badge>;
  }

  if (days <= 30) {
    return <Badge variant="secondary">Próximo</Badge>;
  }

  return <Badge variant="outline">Vigente</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default function Reportes() {
  const { products, movements } = useInventory();

  const { ventasOrdenadas, ventasMap } = useMemo(() => {
    const map = new Map<string, VentaProducto>();

    movements
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const sku = movement.productSku;
        const current = map.get(sku);

        if (current) {
          current.cantidadVendida += Number(movement.quantity ?? 0);
          current.ingresoTotal += Number(movement.ingreso_total ?? 0);
          current.gananciaTotal += Number(movement.ganancia ?? 0);
        } else {
          map.set(sku, {
            sku,
            nombre: movement.productName,
            cantidadVendida: Number(movement.quantity ?? 0),
            ingresoTotal: Number(movement.ingreso_total ?? 0),
            gananciaTotal: Number(movement.ganancia ?? 0),
          });
        }
      });

    const ventas = Array.from(map.values()).sort(
      (a, b) => b.cantidadVendida - a.cantidadVendida
    );

    return {
      ventasOrdenadas: ventas,
      ventasMap: map,
    };
  }, [movements]);

  const productosMasVendidos = ventasOrdenadas.slice(0, 8);

  const productosMenosVendidos = useMemo(() => {
    return products
      .map((product) => {
        const venta = ventasMap.get(product.sku);

        return {
          sku: product.sku,
          nombre: product.nombre,
          cantidadActual: product.cantidad,
          cantidadVendida: venta?.cantidadVendida ?? 0,
          ingresoTotal: venta?.ingresoTotal ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.cantidadVendida !== b.cantidadVendida) {
          return a.cantidadVendida - b.cantidadVendida;
        }

        return a.cantidadActual - b.cantidadActual;
      })
      .slice(0, 8);
  }, [products, ventasMap]);

  const productosCaducidad = useMemo(() => {
    return products
      .map((product) => {
        const caducidad = getCaducidad(product);

        if (!caducidad) return null;

        return {
          sku: product.sku,
          nombre: product.nombre,
          cantidad: product.cantidad,
          caducidad,
          diasRestantes: getDaysToExpiration(caducidad),
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (a as CaducidadProducto).diasRestantes -
          (b as CaducidadProducto).diasRestantes
      ) as CaducidadProducto[];
  }, [products]);

  const productosPorCaducar = productosCaducidad
    .filter((product) => product.diasRestantes <= 30)
    .slice(0, 10);

  const productosStockBajo = useMemo(() => {
    return products
      .filter((product) => product.cantidad < getStockMinimo(product))
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 10);
  }, [products]);

  const productosStockAlto = useMemo(() => {
    return [...products]
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [products]);

  const productosSinVentas = products.filter(
    (product) => !ventasMap.has(product.sku)
  ).length;

  const totalPiezasVendidas = ventasOrdenadas.reduce(
    (total, product) => total + product.cantidadVendida,
    0
  );

  const vencidos = productosCaducidad.filter(
    (product) => product.diasRestantes < 0
  ).length;

  const porCaducar = productosCaducidad.filter(
    (product) => product.diasRestantes >= 0 && product.diasRestantes <= 30
  ).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2 racknova-page-title">
            <BarChart3 className="h-8 w-8" />
            Reportes de Inventario
          </h1>
          <p className="text-muted-foreground">
            Análisis visual de ventas, caducidad y niveles de stock.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="racknova-card racknova-metric-success">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Piezas vendidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalPiezasVendidas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-warning">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Sin ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{productosSinVentas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-warning">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Por caducar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{porCaducar}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-danger">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{vencidos}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-warning">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                Stock bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{productosStockBajo.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Productos más vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {productosMasVendidos.length === 0 ? (
                <EmptyState text="Todavía no hay ventas registradas." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosMasVendidos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cantidadVendida" name="Piezas vendidas">
                      {productosMasVendidos.map((_, index) => (
                        <Cell
                          key={`top-sale-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos menos vendidos / sin ventas</CardTitle>
            </CardHeader>
            <CardContent>
              {productosMenosVendidos.length === 0 ? (
                <EmptyState text="No hay productos para analizar." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosMenosVendidos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="cantidadVendida"
                      name="Piezas vendidas"
                      fill="#f97316"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock bajo</CardTitle>
            </CardHeader>
            <CardContent>
              {productosStockBajo.length === 0 ? (
                <EmptyState text="No hay productos con stock bajo." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosStockBajo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cantidad" name="Cantidad actual" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos con mayor stock</CardTitle>
            </CardHeader>
            <CardContent>
              {productosStockAlto.length === 0 ? (
                <EmptyState text="No hay productos para analizar." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosStockAlto}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cantidad" name="Cantidad actual" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Productos próximos a caducar</CardTitle>
          </CardHeader>
          <CardContent>
            {productosPorCaducar.length === 0 ? (
              <EmptyState text="No hay productos próximos a caducar en los siguientes 30 días." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Días restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosPorCaducar.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        <ExpirationBadge days={product.diasRestantes} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.sku}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.nombre}
                      </TableCell>
                      <TableCell>{product.cantidad}</TableCell>
                      <TableCell>{formatDate(product.caducidad)}</TableCell>
                      <TableCell>
                        {product.diasRestantes < 0
                          ? `${Math.abs(product.diasRestantes)} día(s) vencido`
                          : `${product.diasRestantes} día(s)`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5" />
                Detalle de productos más vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productosMasVendidos.length === 0 ? (
                <EmptyState text="Todavía no hay ventas registradas." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Piezas vendidas</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead>Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosMasVendidos.map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell>
                          <Badge variant="outline">{product.sku}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.nombre}
                        </TableCell>
                        <TableCell>{product.cantidadVendida}</TableCell>
                        <TableCell>{formatMoney(product.ingresoTotal)}</TableCell>
                        <TableCell>{formatMoney(product.gananciaTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de stock bajo</CardTitle>
            </CardHeader>
            <CardContent>
              {productosStockBajo.length === 0 ? (
                <EmptyState text="No hay productos con stock bajo." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock crítico</TableHead>
                      <TableHead>Faltante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosStockBajo.map((product) => {
                      const stockMinimo = getStockMinimo(product);
                      const faltante = Math.max(stockMinimo - product.cantidad, 0);

                      return (
                        <TableRow key={product.sku}>
                          <TableCell>
                            <Badge variant="outline">{product.sku}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.nombre}
                          </TableCell>
                          <TableCell>{product.cantidad}</TableCell>
                          <TableCell>{stockMinimo}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              Faltan {faltante}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
