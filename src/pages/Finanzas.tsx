import React, { useMemo, useState } from "react";
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
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  DollarSign,
  PackageCheck,
  Percent,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

type PeriodoFiltro = "semana" | "mes" | "anio" | "todo";

interface ProductProfitReport {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ventas: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
  margen: number;
  ultimaVenta: Date | null;
}

interface FinancialDatePoint {
  fecha: string;
  ingresos: number;
  costos: number;
  ganancia: number;
  margen: number;
  piezasVendidas: number;
  ventas: number;
}

const CHART_COLORS = {
  income: "#10b981",
  cost: "#f97316",
  profit: "#2563eb",
  margin: "#8b5cf6",
};

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

function percent(value: number) {
  return `${numberFormat(value)}%`;
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

function getMargin(ingresos: number, ganancia: number) {
  if (!ingresos || ingresos <= 0) return 0;

  return (ganancia / ingresos) * 100;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function marginBadge(margen: number) {
  if (margen < 0) {
    return <Badge variant="destructive">Pérdida</Badge>;
  }

  if (margen < 15) {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500">
        Bajo · {percent(margen)}
      </Badge>
    );
  }

  if (margen < 35) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500">
        Aceptable · {percent(margen)}
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">
      Alto · {percent(margen)}
    </Badge>
  );
}

function investmentBadge(porcentaje: number) {
  if (porcentaje <= 0) {
    return <Badge variant="outline">Sin recuperación</Badge>;
  }

  if (porcentaje < 50) {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500">
        En proceso
      </Badge>
    );
  }

  if (porcentaje < 100) {
    return (
      <Badge className="bg-blue-600 hover:bg-blue-600">
        Avanzado
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">
      Recuperado
    </Badge>
  );
}

export default function Finanzas() {
  const { movements } = useInventory();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");

  const ventasFiltradas = useMemo(() => {
    return movements
      .filter((movement) => movement.action === "Egreso")
      .filter((movement) =>
        isMovementInsidePeriod(new Date(movement.timestamp), periodo)
      );
  }, [movements, periodo]);

  /*
   * Recuperación de inversión:
   *
   * Inversión acumulada:
   * suma del costo total registrado en todos los ingresos de inventario.
   *
   * Capital recuperado:
   * suma de los ingresos totales generados por todas las ventas.
   *
   * Costos históricos:
   * costo de adquisición de las unidades que ya fueron vendidas.
   *
   * Ganancia histórica:
   * ingresos históricos menos costos históricos.
   */
  const investmentRecovery = useMemo(() => {
    const ingresosInventario = movements.filter(
      (movement) => movement.action === "Ingreso"
    );

    const ventasHistoricas = movements.filter(
      (movement) => movement.action === "Egreso"
    );

    const inversionAcumulada = ingresosInventario.reduce(
      (total, movement) =>
        total + Number(movement.costo_total ?? 0),
      0
    );

    const ingresosHistoricos = ventasHistoricas.reduce(
      (total, movement) =>
        total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costosHistoricos = ventasHistoricas.reduce(
      (total, movement) =>
        total + Number(movement.costo_total ?? 0),
      0
    );

    /*
     * El capital recuperado es el dinero recibido por ventas,
     * no el costo de los productos vendidos.
     */
    const capitalRecuperado = ingresosHistoricos;

    const gananciaHistorica =
      ingresosHistoricos - costosHistoricos;

    const pendientePorRecuperar = Math.max(
      inversionAcumulada - capitalRecuperado,
      0
    );

    const porcentajeRecuperado =
      inversionAcumulada > 0
        ? (capitalRecuperado / inversionAcumulada) * 100
        : 0;

    /*
     * El porcentaje real puede superar 100%, pero la barra
     * visual solamente debe ocupar hasta el 100%.
     */
    const progresoVisual = Math.min(
      Math.max(porcentajeRecuperado, 0),
      100
    );

    const roiInventario =
      inversionAcumulada > 0
        ? (gananciaHistorica / inversionAcumulada) * 100
        : 0;

    return {
      inversionAcumulada,
      capitalRecuperado,
      pendientePorRecuperar,
      porcentajeRecuperado,
      progresoVisual,
      roiInventario,
      ingresosHistoricos,
      costosHistoricos,
      gananciaHistorica,
      movimientosIngreso: ingresosInventario.length,
      ventasHistoricas: ventasHistoricas.length,
    };
  }, [movements]);

  const financialByDate = useMemo<FinancialDatePoint[]>(() => {
    const map = new Map<string, FinancialDatePoint>();

    ventasFiltradas.forEach((movement) => {
      const fecha = new Date(movement.timestamp)
        .toISOString()
        .slice(0, 10);

      const current = map.get(fecha) ?? {
        fecha,
        ingresos: 0,
        costos: 0,
        ganancia: 0,
        margen: 0,
        piezasVendidas: 0,
        ventas: 0,
      };

      const ingreso = Number(movement.ingreso_total ?? 0);
      const costo = Number(movement.costo_total ?? 0);
      const ganancia = ingreso - costo;

      current.ingresos += ingreso;
      current.costos += costo;
      current.ganancia += ganancia;
      current.piezasVendidas += Number(movement.quantity ?? 0);
      current.ventas += 1;
      current.margen = getMargin(
        current.ingresos,
        current.ganancia
      );

      map.set(fecha, current);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    );
  }, [ventasFiltradas]);

  const productProfitReports = useMemo<ProductProfitReport[]>(() => {
    const map = new Map<string, ProductProfitReport>();

    ventasFiltradas.forEach((movement) => {
      const sku = movement.productSku;
      const fecha = new Date(movement.timestamp);
      const ingreso = Number(movement.ingreso_total ?? 0);
      const costo = Number(movement.costo_total ?? 0);
      const ganancia = ingreso - costo;

      const current = map.get(sku);

      if (current) {
        current.cantidadVendida += Number(
          movement.quantity ?? 0
        );

        current.ventas += 1;
        current.ingresoTotal += ingreso;
        current.costoTotal += costo;
        current.gananciaTotal += ganancia;

        current.margen = getMargin(
          current.ingresoTotal,
          current.gananciaTotal
        );

        if (!current.ultimaVenta || fecha > current.ultimaVenta) {
          current.ultimaVenta = fecha;
        }

        return;
      }

      map.set(sku, {
        sku,
        nombre: movement.productName,
        cantidadVendida: Number(movement.quantity ?? 0),
        ventas: 1,
        ingresoTotal: ingreso,
        costoTotal: costo,
        gananciaTotal: ganancia,
        margen: getMargin(ingreso, ganancia),
        ultimaVenta: fecha,
      });
    });

    return Array.from(map.values());
  }, [ventasFiltradas]);

  const resumen = useMemo(() => {
    const ingresos = ventasFiltradas.reduce(
      (total, movement) =>
        total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costos = ventasFiltradas.reduce(
      (total, movement) =>
        total + Number(movement.costo_total ?? 0),
      0
    );

    const ganancia = ingresos - costos;
    const margen = getMargin(ingresos, ganancia);

    const piezasVendidas = ventasFiltradas.reduce(
      (total, movement) =>
        total + Number(movement.quantity ?? 0),
      0
    );

    const ventaMasAlta = ventasFiltradas.reduce(
      (max, movement) => {
        const ingreso = Number(movement.ingreso_total ?? 0);

        return ingreso > max ? ingreso : max;
      },
      0
    );

    const ticketPromedio =
      ventasFiltradas.length > 0
        ? ingresos / ventasFiltradas.length
        : 0;

    const productoMasRentable =
      [...productProfitReports].sort(
        (a, b) => b.gananciaTotal - a.gananciaTotal
      )[0] ?? null;

    const productosConPerdida = productProfitReports.filter(
      (product) => product.gananciaTotal < 0
    ).length;

    const productosMargenBajo = productProfitReports.filter(
      (product) =>
        product.margen >= 0 && product.margen < 15
    ).length;

    return {
      ingresos,
      costos,
      ganancia,
      margen,
      piezasVendidas,
      ventas: ventasFiltradas.length,
      ticketPromedio,
      ventaMasAlta,
      productoMasRentable,
      productosConPerdida,
      productosMargenBajo,
    };
  }, [ventasFiltradas, productProfitReports]);

  const productosMayorGanancia = useMemo(() => {
    return [...productProfitReports]
      .sort((a, b) => b.gananciaTotal - a.gananciaTotal)
      .slice(0, 10);
  }, [productProfitReports]);

  const productosBajaRentabilidad = useMemo(() => {
    return [...productProfitReports]
      .sort((a, b) => a.margen - b.margen)
      .slice(0, 10);
  }, [productProfitReports]);

  const historicalFinancialRows = useMemo(() => {
    return [...ventasFiltradas]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      )
      .slice(0, 50);
  }, [ventasFiltradas]);

  const executiveMessage = useMemo(() => {
    if (ventasFiltradas.length === 0) {
      return "No hay ventas registradas en el periodo seleccionado. Cuando registres salidas con precio de venta, aquí aparecerá el análisis financiero.";
    }

    const margenTexto = percent(resumen.margen);
    const gananciaTexto = money(resumen.ganancia);
    const ingresosTexto = money(resumen.ingresos);

    if (resumen.ganancia < 0) {
      return `El periodo seleccionado generó ${ingresosTexto}, pero cerró con una pérdida de ${gananciaTexto}. Revisa precios de venta, descuentos y productos con margen negativo.`;
    }

    if (resumen.margen < 15) {
      return `El periodo seleccionado generó ${ingresosTexto}, con utilidad de ${gananciaTexto} y margen bajo de ${margenTexto}. Conviene revisar productos con baja rentabilidad.`;
    }

    return `El periodo seleccionado generó ${ingresosTexto}, con utilidad neta de ${gananciaTexto} y margen de ${margenTexto}. El desempeño financiero es positivo.`;
  }, [ventasFiltradas.length, resumen]);

  const investmentMessage = useMemo(() => {
    if (investmentRecovery.inversionAcumulada <= 0) {
      return "Todavía no hay inversión de inventario registrada. Cuando agregues productos con costo proveedor, aquí se calculará la recuperación de inversión.";
    }

    if (investmentRecovery.porcentajeRecuperado >= 100) {
      return `Los ingresos históricos ya cubrieron el 100% de la inversión acumulada en inventario. El sistema registra un ROI de ${percent(
        investmentRecovery.roiInventario
      )} sobre la inversión histórica.`;
    }

    return `Los ingresos por ventas han cubierto ${percent(
      investmentRecovery.porcentajeRecuperado
    )} de la inversión acumulada en inventario. Todavía falta generar ${money(
      investmentRecovery.pendientePorRecuperar
    )} en ingresos para cubrirla completamente.`;
  }, [investmentRecovery]);

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-slate-100 text-slate-950 shadow-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/30" />

        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-sm text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-blue-50">
                <Wallet className="h-4 w-4" />
                Panel financiero RackNova
              </div>

              <div>
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
                  Finanzas
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                </h1>

                <p className="mt-2 max-w-3xl text-slate-600 dark:text-blue-100">
                  Control de ingresos, costos, ganancia neta,
                  margen de utilidad y recuperación de inversión
                  del inventario.
                </p>
              </div>

              <div className="max-w-4xl rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {executiveMessage}
                </p>
              </div>
            </div>

            <div className="min-w-[220px] space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-blue-100">
                Periodo de análisis
              </p>

              <Select
                value={periodo}
                onValueChange={(value) =>
                  setPeriodo(value as PeriodoFiltro)
                }
              >
                <SelectTrigger className="bg-background text-foreground">
                  <SelectValue placeholder="Selecciona un periodo" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="semana">
                    Últimos 7 días
                  </SelectItem>

                  <SelectItem value="mes">
                    Mes actual
                  </SelectItem>

                  <SelectItem value="anio">
                    Año actual
                  </SelectItem>

                  <SelectItem value="todo">
                    Todo el historial
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
                <p className="text-sm text-slate-500 dark:text-blue-100">
                  Periodo
                </p>

                <p className="font-bold">
                  {getPeriodoLabel(periodo)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Ventas registradas
              </p>

              <p className="text-2xl font-bold">
                {resumen.ventas}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Piezas vendidas
              </p>

              <p className="text-2xl font-bold">
                {resumen.piezasVendidas}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Producto más rentable
              </p>

              <p className="truncate text-lg font-bold">
                {resumen.productoMasRentable?.nombre ?? "-"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Margen
              </p>

              <p className="text-2xl font-bold text-purple-600">
                {percent(resumen.margen)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ingresos totales
                </p>

                <p className="text-2xl font-bold text-emerald-600">
                  {money(resumen.ingresos)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Costos totales
                </p>

                <p className="text-2xl font-bold text-orange-600">
                  {money(resumen.costos)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ganancia neta
                </p>

                <p
                  className={`text-2xl font-bold ${
                    resumen.ganancia >= 0
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}
                >
                  {money(resumen.ganancia)}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  resumen.ganancia >= 0
                    ? "bg-blue-100 dark:bg-blue-950"
                    : "bg-red-100 dark:bg-red-950"
                }`}
              >
                {resumen.ganancia >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-blue-600" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Margen de utilidad
                </p>

                <p
                  className={`text-2xl font-bold ${
                    resumen.margen >= 15
                      ? "text-purple-600"
                      : "text-red-600"
                  }`}
                >
                  {percent(resumen.margen)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                <Percent className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-emerald-600" />
                Recuperación de inversión de inventario
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Esta sección usa todo el historial de movimientos,
                no solo el periodo seleccionado.
              </p>
            </div>

            {investmentBadge(
              investmentRecovery.porcentajeRecuperado
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-semibold">
                Progreso de recuperación
              </p>

              <p className="text-lg font-bold text-emerald-600">
                {percent(
                  investmentRecovery.porcentajeRecuperado
                )}
              </p>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{
                  width: `${investmentRecovery.progresoVisual}%`,
                }}
              />
            </div>

            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {investmentMessage}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Inversión acumulada
              </p>

              <p className="mt-1 text-xl font-bold">
                {money(
                  investmentRecovery.inversionAcumulada
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Capital recuperado
              </p>

              <p className="mt-1 text-xl font-bold text-emerald-600">
                {money(
                  investmentRecovery.capitalRecuperado
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Ingresos históricos por ventas
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Pendiente
              </p>

              <p className="mt-1 text-xl font-bold text-orange-600">
                {money(
                  investmentRecovery.pendientePorRecuperar
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                Recuperado
              </p>

              <p className="mt-1 text-xl font-bold text-blue-600">
                {percent(
                  investmentRecovery.porcentajeRecuperado
                )}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                ROI inventario
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  investmentRecovery.roiInventario >= 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {percent(investmentRecovery.roiInventario)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Ingresos históricos
              </p>

              <p className="mt-1 text-xl font-bold text-emerald-600">
                {money(
                  investmentRecovery.ingresosHistoricos
                )}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Costos históricos vendidos
              </p>

              <p className="mt-1 text-xl font-bold text-orange-600">
                {money(
                  investmentRecovery.costosHistoricos
                )}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Ganancia histórica
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  investmentRecovery.gananciaHistorica >= 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {money(
                  investmentRecovery.gananciaHistorica
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ticket promedio
                </p>

                <p className="text-2xl font-bold">
                  {money(resumen.ticketPromedio)}
                </p>
              </div>

              <Receipt className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Venta más alta
                </p>

                <p className="text-2xl font-bold text-emerald-600">
                  {money(resumen.ventaMasAlta)}
                </p>
              </div>

              <Trophy className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos con pérdida
                </p>

                <p className="text-2xl font-bold text-red-600">
                  {resumen.productosConPerdida}
                </p>
              </div>

              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Margen bajo
                </p>

                <p className="text-2xl font-bold text-orange-600">
                  {resumen.productosMargenBajo}
                </p>
              </div>

              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Ingresos, costos y ganancia
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[360px]">
            {financialByDate.length === 0 ? (
              <EmptyState text="No hay datos financieros para graficar en este periodo." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <ComposedChart data={financialByDate}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(value) =>
                      formatDate(value)
                    }
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />

                  <YAxis
                    tickFormatter={(value) =>
                      `$${Number(value).toFixed(0)}`
                    }
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={(value) =>
                      formatDate(String(value))
                    }
                    formatter={(value, name) => [
                      money(Number(value)),
                      String(name),
                    ]}
                  />

                  <Legend />

                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    fill={CHART_COLORS.income}
                    stroke={CHART_COLORS.income}
                    fillOpacity={0.18}
                  />

                  <Bar
                    dataKey="costos"
                    name="Costos"
                    fill={CHART_COLORS.cost}
                    radius={[6, 6, 0, 0]}
                  />

                  <Line
                    type="monotone"
                    dataKey="ganancia"
                    name="Ganancia"
                    stroke={CHART_COLORS.profit}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Margen por fecha
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[360px]">
            {financialByDate.length === 0 ? (
              <EmptyState text="No hay datos de margen para el periodo seleccionado." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart data={financialByDate}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(value) =>
                      formatDate(value)
                    }
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />

                  <YAxis
                    tickFormatter={(value) =>
                      `${Number(value).toFixed(0)}%`
                    }
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />

                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={(value) =>
                      formatDate(String(value))
                    }
                    formatter={(value) => [
                      `${numberFormat(Number(value))}%`,
                      "Margen",
                    ]}
                  />

                  <Bar
                    dataKey="margen"
                    name="Margen"
                    fill={CHART_COLORS.margin}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Productos más rentables
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosMayorGanancia.length === 0 ? (
              <EmptyState text="No hay productos vendidos en este periodo." />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="racknova-table-header">
                      <TableHead>#</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Vendidas</TableHead>
                      <TableHead>Ingresos</TableHead>
                      <TableHead>Costos</TableHead>
                      <TableHead>Ganancia</TableHead>
                      <TableHead>Margen</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosMayorGanancia.map(
                      (product, index) => (
                        <TableRow key={product.sku}>
                          <TableCell>{index + 1}</TableCell>

                          <TableCell>
                            <p className="font-medium">
                              {product.nombre}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {product.sku}
                            </p>
                          </TableCell>

                          <TableCell>
                            {product.cantidadVendida}
                          </TableCell>

                          <TableCell>
                            {money(product.ingresoTotal)}
                          </TableCell>

                          <TableCell>
                            {money(product.costoTotal)}
                          </TableCell>

                          <TableCell className="font-semibold text-blue-600">
                            {money(product.gananciaTotal)}
                          </TableCell>

                          <TableCell>
                            {marginBadge(product.margen)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Baja rentabilidad
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosBajaRentabilidad.length === 0 ? (
              <EmptyState text="No hay información de rentabilidad en este periodo." />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="racknova-table-header">
                      <TableHead>Producto</TableHead>
                      <TableHead>Ingresos</TableHead>
                      <TableHead>Costos</TableHead>
                      <TableHead>Ganancia</TableHead>
                      <TableHead>Margen</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosBajaRentabilidad.map(
                      (product) => (
                        <TableRow key={product.sku}>
                          <TableCell>
                            <p className="font-medium">
                              {product.nombre}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {product.sku}
                            </p>
                          </TableCell>

                          <TableCell>
                            {money(product.ingresoTotal)}
                          </TableCell>

                          <TableCell>
                            {money(product.costoTotal)}
                          </TableCell>

                          <TableCell
                            className={
                              product.gananciaTotal >= 0
                                ? "font-semibold text-emerald-600"
                                : "font-semibold text-red-600"
                            }
                          >
                            {money(product.gananciaTotal)}
                          </TableCell>

                          <TableCell>
                            {marginBadge(product.margen)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
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
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Histórico financiero
          </CardTitle>
        </CardHeader>

        <CardContent>
          {historicalFinancialRows.length === 0 ? (
            <EmptyState text="No hay ventas para mostrar en este periodo." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="racknova-table-header">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Ganancia</TableHead>
                      <TableHead>Margen</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {historicalFinancialRows.map(
                      (movement) => {
                        const ingreso = Number(
                          movement.ingreso_total ?? 0
                        );

                        const costo = Number(
                          movement.costo_total ?? 0
                        );

                        const ganancia = ingreso - costo;

                        const margen = getMargin(
                          ingreso,
                          ganancia
                        );

                        return (
                          <TableRow key={movement.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(
                                movement.timestamp
                              )}
                            </TableCell>

                            <TableCell>
                              <p className="font-medium">
                                {movement.productName}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                {movement.productSku}
                              </p>
                            </TableCell>

                            <TableCell>
                              {movement.quantity}
                            </TableCell>

                            <TableCell>
                              {money(ingreso)}
                            </TableCell>

                            <TableCell>
                              {money(costo)}
                            </TableCell>

                            <TableCell
                              className={
                                ganancia >= 0
                                  ? "font-semibold text-blue-600"
                                  : "font-semibold text-red-600"
                              }
                            >
                              <div className="flex items-center gap-1">
                                {ganancia >= 0 ? (
                                  <ArrowUpRight className="h-4 w-4" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4" />
                                )}

                                {money(ganancia)}
                              </div>
                            </TableCell>

                            <TableCell>
                              {percent(margen)}
                            </TableCell>
                          </TableRow>
                        );
                      }
                    )}
                  </TableBody>
                </Table>
              </div>

              {ventasFiltradas.length > 50 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando las 50 ventas más recientes del
                  periodo.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-slate-600" />
            Cálculo financiero usado
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            La ganancia neta del periodo se calcula como ingresos
            totales menos costos totales. El margen se calcula
            como ganancia dividida entre ingresos.
          </p>

          <p>
            La recuperación de inversión utiliza todo el
            historial: compara la inversión acumulada al ingresar
            inventario contra los ingresos totales obtenidos
            mediante ventas.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <PackageCheck className="h-4 w-4 text-blue-600" />
                Inversión acumulada
              </div>

              Suma de <code>costo_total</code> en movimientos de
              ingreso.
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Capital recuperado
              </div>

              Suma de <code>ingreso_total</code> en movimientos de
              egreso.
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <Calculator className="h-4 w-4 text-purple-600" />
                Ganancia histórica
              </div>

              Ingresos históricos menos costos históricos vendidos.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
