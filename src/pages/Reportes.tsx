import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Download,
  Printer,
  ShoppingCart,
  Percent,
  Lightbulb,
} from "lucide-react";

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

type CaducidadProducto = {
  sku: string;
  nombre: string;
  cantidad: number;
  caducidad: string;
  diasRestantes: number;
};

type ProductoAnalizado = {
  sku: string;
  nombre: string;
  cantidadActual: number;
  stockMinimo: number;
  caducidad: string | null;
  diasCaducidad: number | null;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
  promedioVentaDiaria: number;
  diasEstimadosStock: number | null;
  margen: number;
};

type Recomendacion = {
  tipo:
    | "COMPRA"
    | "DESCUENTO"
    | "CADUCIDAD"
    | "STOCK"
    | "ROTACION"
    | "RENTABLE";
  prioridad: "Alta" | "Media" | "Baja";
  sku: string;
  nombre: string;
  mensaje: string;
  accion: string;
  valorReferencia: string;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
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

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 1;

  const startClean = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const endClean = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  const diffMs = endClean.getTime() - startClean.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(days, 1);
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

function PriorityBadge({ prioridad }: { prioridad: Recomendacion["prioridad"] }) {
  if (prioridad === "Alta") {
    return <Badge variant="destructive">Alta</Badge>;
  }

  if (prioridad === "Media") {
    return <Badge variant="secondary">Media</Badge>;
  }

  return <Badge variant="outline">Baja</Badge>;
}

function TypeBadge({ tipo }: { tipo: Recomendacion["tipo"] }) {
  const labels: Record<Recomendacion["tipo"], string> = {
    COMPRA: "Comprar",
    DESCUENTO: "Descuento",
    CADUCIDAD: "Caducidad",
    STOCK: "Stock",
    ROTACION: "Rotación",
    RENTABLE: "Rentable",
  };

  return <Badge variant="outline">{labels[tipo]}</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed">
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

    const ventas = Array.from(map.values()).sort(
      (a, b) => b.cantidadVendida - a.cantidadVendida
    );

    return {
      ventasOrdenadas: ventas,
      ventasMap: map,
    };
  }, [movements]);

  const productosAnalizados = useMemo(() => {
    return products.map((product) => {
      const venta = ventasMap.get(product.sku);
      const stockMinimo = getStockMinimo(product);
      const caducidad = getCaducidad(product);
      const diasCaducidad = caducidad ? getDaysToExpiration(caducidad) : null;

      const cantidadVendida = venta?.cantidadVendida ?? 0;
      const ingresoTotal = venta?.ingresoTotal ?? 0;
      const costoTotal = venta?.costoTotal ?? 0;
      const gananciaTotal = venta?.gananciaTotal ?? 0;

      const periodoVentaDias = daysBetween(
        venta?.primeraVenta ?? null,
        venta?.ultimaVenta ?? null
      );

      const promedioVentaDiaria =
        cantidadVendida > 0 ? cantidadVendida / periodoVentaDias : 0;

      const diasEstimadosStock =
        promedioVentaDiaria > 0
          ? product.cantidad / promedioVentaDiaria
          : null;

      const margen =
        ingresoTotal > 0 ? (gananciaTotal / ingresoTotal) * 100 : 0;

      return {
        sku: product.sku,
        nombre: product.nombre,
        cantidadActual: product.cantidad,
        stockMinimo,
        caducidad,
        diasCaducidad,
        cantidadVendida,
        ingresoTotal,
        costoTotal,
        gananciaTotal,
        promedioVentaDiaria,
        diasEstimadosStock,
        margen,
      };
    });
  }, [products, ventasMap]);

  const recomendaciones = useMemo(() => {
    const lista: Recomendacion[] = [];

    productosAnalizados.forEach((product) => {
      const stockBajo = product.cantidadActual < product.stockMinimo;
      const stockCritico =
        product.diasEstimadosStock !== null &&
        product.diasEstimadosStock <= 7;

      const stockCorto =
        product.diasEstimadosStock !== null &&
        product.diasEstimadosStock > 7 &&
        product.diasEstimadosStock <= 14;

      const sinVentas = product.cantidadVendida === 0;
      const bajaRotacion =
        product.cantidadVendida > 0 && product.promedioVentaDiaria < 0.25;

      const stockAlto =
        product.cantidadActual >= product.stockMinimo * 3 &&
        (sinVentas || bajaRotacion);

      const caducado =
        product.diasCaducidad !== null && product.diasCaducidad < 0;

      const proximoCaducar =
        product.diasCaducidad !== null &&
        product.diasCaducidad >= 0 &&
        product.diasCaducidad <= 30;

      const caducaUrgente =
        product.diasCaducidad !== null &&
        product.diasCaducidad >= 0 &&
        product.diasCaducidad <= 7;

      const rentable =
        product.cantidadVendida > 0 &&
        product.gananciaTotal > 0 &&
        product.margen >= 30;

      if (stockBajo || stockCritico || stockCorto) {
        const ventaBase = Math.max(product.promedioVentaDiaria, 1);
        const cantidadSugerida = Math.max(
          Math.ceil(ventaBase * 14 + product.stockMinimo - product.cantidadActual),
          product.stockMinimo - product.cantidadActual,
          1
        );

        lista.push({
          tipo: "COMPRA",
          prioridad: stockBajo || stockCritico ? "Alta" : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje:
            product.diasEstimadosStock !== null
              ? `Riesgo de agotamiento en ${formatNumber(
                  product.diasEstimadosStock
                )} día(s).`
              : "El producto está por debajo del stock crítico.",
          accion: `Sugerencia: comprar aproximadamente ${cantidadSugerida} pieza(s).`,
          valorReferencia: `Stock actual: ${product.cantidadActual} / mínimo: ${product.stockMinimo}`,
        });
      }

      if (caducado || proximoCaducar) {
        lista.push({
          tipo: "CADUCIDAD",
          prioridad: caducado || caducaUrgente ? "Alta" : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: caducado
            ? `Producto vencido hace ${Math.abs(
                product.diasCaducidad ?? 0
              )} día(s).`
            : `Caduca en ${product.diasCaducidad} día(s).`,
          accion: caducado
            ? "Sugerencia: retirar, revisar o dar prioridad inmediata."
            : "Sugerencia: priorizar salida o aplicar promoción.",
          valorReferencia: product.caducidad
            ? `Caducidad: ${formatDate(product.caducidad)}`
            : "Sin caducidad",
        });
      }

      if (stockAlto) {
        lista.push({
          tipo: "DESCUENTO",
          prioridad: proximoCaducar ? "Alta" : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje:
            "Tiene stock alto y baja rotación. Puede ocupar espacio innecesario.",
          accion: proximoCaducar
            ? "Sugerencia: descuento de 15% a 25%."
            : "Sugerencia: descuento de 10% a 15% o promoción por volumen.",
          valorReferencia: `Stock actual: ${product.cantidadActual}`,
        });
      }

      if (sinVentas && product.cantidadActual > 0) {
        lista.push({
          tipo: "ROTACION",
          prioridad: product.cantidadActual >= product.stockMinimo * 2 ? "Media" : "Baja",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: "No registra ventas en el historial actual.",
          accion: "Sugerencia: revisar precio, ubicación o demanda.",
          valorReferencia: `Stock actual: ${product.cantidadActual}`,
        });
      }

      if (rentable) {
        lista.push({
          tipo: "RENTABLE",
          prioridad: product.cantidadActual < product.stockMinimo * 2 ? "Media" : "Baja",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: `Producto rentable con margen aproximado de ${formatNumber(
            product.margen
          )}%.`,
          accion:
            product.cantidadActual < product.stockMinimo * 2
              ? "Sugerencia: mantener inventario suficiente."
              : "Sugerencia: mantener seguimiento de ventas.",
          valorReferencia: `Ganancia: ${formatMoney(product.gananciaTotal)}`,
        });
      }
    });

    const priorityOrder = {
      Alta: 0,
      Media: 1,
      Baja: 2,
    };

    return lista.sort(
      (a, b) => priorityOrder[a.prioridad] - priorityOrder[b.prioridad]
    );
  }, [productosAnalizados]);

  const productosMasVendidos = ventasOrdenadas.slice(0, 8);

  const productosMenosVendidos = useMemo(() => {
    return productosAnalizados
      .sort((a, b) => {
        if (a.cantidadVendida !== b.cantidadVendida) {
          return a.cantidadVendida - b.cantidadVendida;
        }

        return a.cantidadActual - b.cantidadActual;
      })
      .slice(0, 8);
  }, [productosAnalizados]);

  const productosCaducidad = useMemo(() => {
    return productosAnalizados
      .filter((product) => product.caducidad)
      .map((product) => ({
        sku: product.sku,
        nombre: product.nombre,
        cantidad: product.cantidadActual,
        caducidad: product.caducidad as string,
        diasRestantes: product.diasCaducidad ?? 0,
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [productosAnalizados]);

  const productosPorCaducar = productosCaducidad
    .filter((product) => product.diasRestantes <= 30)
    .slice(0, 10);

  const productosStockBajo = useMemo(() => {
    return productosAnalizados
      .filter((product) => product.cantidadActual < product.stockMinimo)
      .sort((a, b) => a.cantidadActual - b.cantidadActual)
      .slice(0, 10);
  }, [productosAnalizados]);

  const productosStockAlto = useMemo(() => {
    return [...productosAnalizados]
      .sort((a, b) => b.cantidadActual - a.cantidadActual)
      .slice(0, 10);
  }, [productosAnalizados]);

  const comprasSugeridas = recomendaciones
    .filter((item) => item.tipo === "COMPRA")
    .slice(0, 10);

  const descuentosSugeridos = recomendaciones
    .filter((item) => item.tipo === "DESCUENTO" || item.tipo === "CADUCIDAD")
    .slice(0, 10);

  const productosSinVentas = productosAnalizados.filter(
    (product) => product.cantidadVendida === 0 && product.cantidadActual > 0
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

  const alertasAltas = recomendaciones.filter(
    (item) => item.prioridad === "Alta"
  ).length;

  const productosRentables = recomendaciones.filter(
    (item) => item.tipo === "RENTABLE"
  ).length;

  const exportRecommendationsCSV = () => {
    const headers = [
      "prioridad",
      "tipo",
      "sku",
      "producto",
      "mensaje",
      "accion",
      "referencia",
    ];

    const rows = recomendaciones.map((item) => [
      item.prioridad,
      item.tipo,
      item.sku,
      item.nombre,
      item.mensaje,
      item.accion,
      item.valorReferencia,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `racknova-reporte-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2 racknova-page-title">
              <BarChart3 className="h-8 w-8" />
              Reportes e Insights
            </h1>

            <p className="text-muted-foreground">
              Análisis visual, recomendaciones predictivas y reportes ejecutivos
              del inventario.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printReport}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / PDF
            </Button>

            <Button onClick={exportRecommendationsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <Card className="racknova-card border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              RackNova Insights
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Motor predictivo basado en reglas: analiza ventas, stock,
              caducidad y rentabilidad para sugerir decisiones de compra,
              descuento y prioridad de salida.
            </p>
          </CardHeader>

          <CardContent>
            {recomendaciones.length === 0 ? (
              <EmptyState text="Aún no hay datos suficientes para generar recomendaciones." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {recomendaciones.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item.tipo}-${item.sku}-${index}`}
                    className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <TypeBadge tipo={item.tipo} />
                      <PriorityBadge prioridad={item.prioridad} />
                    </div>

                    <div>
                      <p className="font-semibold">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </p>
                    </div>

                    <p className="text-sm">{item.mensaje}</p>

                    <div className="rounded-md bg-muted p-3 text-sm">
                      <p className="font-medium">{item.accion}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.valorReferencia}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card className="racknova-card racknova-metric-success">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Vendidas
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

          <Card className="racknova-card racknova-metric-danger">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                Alertas altas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{alertasAltas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-info">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <PackageCheck className="h-4 w-4" />
                Rentables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{productosRentables}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="racknova-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Recomendación de compra
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Productos con riesgo de agotamiento o por debajo del stock
                crítico.
              </p>
            </CardHeader>

            <CardContent>
              {comprasSugeridas.length === 0 ? (
                <EmptyState text="No hay productos con recomendación de compra." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {comprasSugeridas.map((item, index) => (
                      <TableRow key={`compra-${item.sku}-${index}`}>
                        <TableCell>
                          <PriorityBadge prioridad={item.prioridad} />
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">{item.sku}</Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.nombre}
                        </TableCell>

                        <TableCell>{item.mensaje}</TableCell>

                        <TableCell>{item.accion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Descuentos / prioridad de salida
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Productos con baja rotación, stock alto o cercanos a caducar.
              </p>
            </CardHeader>

            <CardContent>
              {descuentosSugeridos.length === 0 ? (
                <EmptyState text="No hay productos con recomendación de descuento." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {descuentosSugeridos.map((item, index) => (
                      <TableRow key={`descuento-${item.sku}-${index}`}>
                        <TableCell>
                          <PriorityBadge prioridad={item.prioridad} />
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">{item.sku}</Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.nombre}
                        </TableCell>

                        <TableCell>{item.mensaje}</TableCell>

                        <TableCell>{item.accion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="racknova-card">
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

          <Card className="racknova-card">
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
                      fill="hsl(var(--chart-orange))"
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
                    <Bar
                      dataKey="cantidadActual"
                      name="Cantidad actual"
                      fill="hsl(var(--chart-red))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card">
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
                    <Bar
                      dataKey="cantidadActual"
                      name="Cantidad actual"
                      fill="hsl(var(--chart-green))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="racknova-card">
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

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Reporte ejecutivo de recomendaciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tabla general para revisar decisiones sugeridas por el sistema.
            </p>
          </CardHeader>

          <CardContent>
            {recomendaciones.length === 0 ? (
              <EmptyState text="No hay recomendaciones generadas." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                    <TableHead>Acción sugerida</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {recomendaciones.map((item, index) => (
                    <TableRow key={`reporte-${item.sku}-${item.tipo}-${index}`}>
                      <TableCell>
                        <PriorityBadge prioridad={item.prioridad} />
                      </TableCell>

                      <TableCell>
                        <TypeBadge tipo={item.tipo} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{item.sku}</Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {item.nombre}
                      </TableCell>

                      <TableCell>{item.mensaje}</TableCell>

                      <TableCell>{item.accion}</TableCell>

                      <TableCell>{item.valorReferencia}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
