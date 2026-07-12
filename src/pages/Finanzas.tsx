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
  ComposedChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Percent,
  Trophy,
  AlertTriangle,
  Activity,
  ShoppingCart,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PiggyBank,
  Target,
  PackageCheck,
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
  danger: "#ef4444",
  neutral: "#64748b",
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function getMargin(ingresos: number, ganancia: number) {
  if (!ingresos || ingresos <= 0) return 0;

  return (ganancia / ingresos) * 100;
}

function marginBadge(margen: number) {
  if (margen < 0) {
    return <Badge variant="destructive">Pérdida</Badge>;
  }

  if (margen < 15) {
    return <Badge className="bg-orange-500 hover:bg-orange-500">Bajo</Badge>;
  }

  if (margen < 35) {
    return <Badge className="bg-blue-600 hover:bg-blue-600">Aceptable</Badge>;
  }

  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Alto</Badge>;
}

function investmentBadge(porcentaje: number) {
  if (porcentaje <= 0) {
    return <Badge variant="outline">Sin recuperación</Badge>;
  }

  if (porcentaje < 50) {
    return <Badge className="bg-orange-500 hover:bg-orange-500">En proceso</Badge>;
  }

  if (porcentaje < 100) {
    return <Badge className="bg-blue-600 hover:bg-blue-600">Avanzado</Badge>;
  }

  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Recuperado</Badge>;
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

  const investmentRecovery = useMemo(() => {
    const ingresosInventario = movements.filter(
      (movement) => movement.action === "Ingreso"
    );

    const ventasHistoricas = movements.filter(
      (movement) => movement.action === "Egreso"
    );

    const inversionAcumulada = ingresosInventario.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const capitalRecuperado = ventasHistoricas.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const ingresosHistoricos = ventasHistoricas.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costosHistoricos = capitalRecuperado;
    const gananciaHistorica = ingresosHistoricos - costosHistoricos;

    const pendientePorRecuperar = Math.max(
      inversionAcumulada - capitalRecuperado,
      0
    );

    const porcentajeRecuperado =
      inversionAcumulada > 0
        ? (capitalRecuperado / inversionAcumulada) * 100
        : 0;

    const progresoVisual = Math.min(Math.max(porcentajeRecuperado, 0), 100);

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

  const financialByDate = useMemo(() => {
    const map = new Map<string, FinancialDatePoint>();

    ventasFiltradas.forEach((movement) => {
      const fecha = new Date(movement.timestamp).toISOString().slice(0, 10);

      const current =
        map.get(fecha) ??
        {
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
      current.margen = getMargin(current.ingresos, current.ganancia);

      map.set(fecha, current);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    );
  }, [ventasFiltradas]);

  const productProfitReports = useMemo(() => {
    const map = new Map<string, ProductProfitReport>();

    ventasFiltradas.forEach((movement) => {
      const sku = movement.productSku;
      const fecha = new Date(movement.timestamp);

      const ingreso = Number(movement.ingreso_total ?? 0);
      const costo = Number(movement.costo_total ?? 0);
      const ganancia = ingreso - costo;

      const current = map.get(sku);

      if (current) {
        current.cantidadVendida += Number(movement.quantity ?? 0);
        current.ventas += 1;
        current.ingresoTotal += ingreso;
        current.costoTotal += costo;
        current.gananciaTotal += ganancia;
        current.margen = getMargin(current.ingresoTotal, current.gananciaTotal);

        if (!current.ultimaVenta || fecha > current.ultimaVenta) {
          current.ultimaVenta = fecha;
        }
      } else {
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
      }
    });

    return Array.from(map.values());
  }, [ventasFiltradas]);

  const resumen = useMemo(() => {
    const ingresos = ventasFiltradas.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costos = ventasFiltradas.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const ganancia = ingresos - costos;
    const margen = getMargin(ingresos, ganancia);

    const piezasVendidas = ventasFiltradas.reduce(
      (total, movement) => total + Number(movement.quantity ?? 0),
      0
    );

    const ventaMasAlta = ventasFiltradas.reduce((max, movement) => {
      const ingreso = Number(movement.ingreso_total ?? 0);
      return ingreso > max ? ingreso : max;
    }, 0);

    const ticketPromedio =
      ventasFiltradas.length > 0 ? ingresos / ventasFiltradas.length : 0;

    const productoMasRentable =
      [...productProfitReports].sort(
        (a, b) => b.gananciaTotal - a.gananciaTotal
      )[0] ?? null;

    const productosConPerdida = productProfitReports.filter(
      (product) => product.gananciaTotal < 0
    ).length;

    const productosMargenBajo = productProfitReports.filter(
      (product) => product.margen >= 0 && product.margen < 15
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
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
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
      return `La inversión acumulada de inventario ya fue recuperada. El sistema registra un ROI de ${percent(
        investmentRecovery.roiInventario
      )} sobre la inversión histórica.`;
    }

    return `Has recuperado ${percent(
      investmentRecovery.porcentajeRecuperado
    )} de la inversión acumulada de inventario. Aún falta recuperar ${money(
      investmentRecovery.pendientePorRecuperar
    )} en costo de inventario.`;
  }, [investmentRecovery]);

  

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-slate-100 text-slate-950 shadow-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/30" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm border border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-blue-50">
                <Wallet className="h-4 w-4" />
                Panel financiero RackNova
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Finanzas
                </h1>
                <p className="text-slate-600 mt-2 max-w-2xl dark:text-blue-100">
                  Control de ingresos, costos, ganancia neta, margen de utilidad
                  y recuperación de inversión del inventario.
                </p>
              </div>

              <div className="rounded-xl bg-white/75 border border-slate-200 p-4 max-w-3xl dark:bg-white/10 dark:border-white/15">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {executiveMessage}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[210px]">
              <Select
                value={periodo}
                onValueChange={(value) => setPeriodo(value as PeriodoFiltro)}
              >
                <SelectTrigger className="bg-white text-slate-950 border-slate-200 dark:border-white">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="semana">Últimos 7 días</SelectItem>
                  <SelectItem value="mes">Mes actual</SelectItem>
                  <SelectItem value="anio">Año actual</SelectItem>
                  <SelectItem value="todo">Todo el historial</SelectItem>
                </SelectContent>
              </Select>

              
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Periodo
              </p>
              <p className="text-xl font-bold">{getPeriodoLabel(periodo)}</p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Ventas registradas
              </p>
              <p className="text-xl font-bold">{resumen.ventas}</p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Piezas vendidas
              </p>
              <p className="text-xl font-bold">{resumen.piezasVendidas}</p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Producto más rentable
              </p>
              <p className="text-xl font-bold truncate">
                {resumen.productoMasRentable?.nombre ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card overflow-hidden">
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
              <div className="h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Costos totales</p>
                <p className="text-2xl font-bold text-orange-600">
                  {money(resumen.costos)}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ganancia neta</p>
                <p
                  className={`text-2xl font-bold ${
                    resumen.ganancia >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {money(resumen.ganancia)}
                </p>
              </div>
              <div
                className={`h-11 w-11 rounded-full flex items-center justify-center ${
                  resumen.ganancia >= 0
                    ? "bg-blue-100 dark:bg-blue-950"
                    : "bg-red-100 dark:bg-red-950"
                }`}
              >
                {resumen.ganancia >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Margen de utilidad
                </p>
                <p
                  className={`text-2xl font-bold ${
                    resumen.margen >= 15 ? "text-purple-600" : "text-red-600"
                  }`}
                >
                  {percent(resumen.margen)}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                <Percent className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card overflow-hidden border-blue-200 dark:border-blue-900">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-blue-600" />
                Recuperación de inversión de inventario
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Esta sección usa todo el historial de movimientos, no solo el
                periodo seleccionado.
              </p>
            </div>

            {investmentBadge(investmentRecovery.porcentajeRecuperado)}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-emerald-50 p-5 dark:from-blue-950/40 dark:to-emerald-950/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Progreso de recuperación
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  {percent(investmentRecovery.porcentajeRecuperado)}
                </p>
              </div>

              <div className="text-sm text-muted-foreground md:text-right max-w-xl">
                {investmentMessage}
              </div>
            </div>

            <div className="mt-5 h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-500 transition-all duration-700"
                style={{
                  width: `${investmentRecovery.progresoVisual}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground">
                    Inversión acumulada
                  </p>
                </div>
                <p className="text-xl font-bold">
                  {money(investmentRecovery.inversionAcumulada)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PackageCheck className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm text-muted-foreground">
                    Capital recuperado
                  </p>
                </div>
                <p className="text-xl font-bold text-emerald-600">
                  {money(investmentRecovery.capitalRecuperado)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <p className="text-sm text-muted-foreground">
                    Pendiente
                  </p>
                </div>
                <p className="text-xl font-bold text-orange-600">
                  {money(investmentRecovery.pendientePorRecuperar)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-purple-600" />
                  <p className="text-sm text-muted-foreground">
                    Recuperado
                  </p>
                </div>
                <p className="text-xl font-bold text-purple-600">
                  {percent(investmentRecovery.porcentajeRecuperado)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground">
                    ROI inventario
                  </p>
                </div>
                <p
                  className={`text-xl font-bold ${
                    investmentRecovery.roiInventario >= 0
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}
                >
                  {percent(investmentRecovery.roiInventario)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Ticket promedio</p>
            <p className="text-2xl font-bold">
              {money(resumen.ticketPromedio)}
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Venta más alta</p>
            <p className="text-2xl font-bold">{money(resumen.ventaMasAlta)}</p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Productos con pérdida
            </p>
            <p className="text-2xl font-bold text-red-600">
              {resumen.productosConPerdida}
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Margen bajo</p>
            <p className="text-2xl font-bold text-orange-600">
              {resumen.productosMargenBajo}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="racknova-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ingresos, costos y ganancia
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[360px]">
            {financialByDate.length === 0 ? (
              <EmptyState text="No hay ventas financieras en este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={financialByDate}>
                  <defs>
                    <linearGradient
                      id="incomeGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={CHART_COLORS.income}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_COLORS.income}
                        stopOpacity={0.02}
                      />
                    </linearGradient>

                    <linearGradient
                      id="profitGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={CHART_COLORS.profit}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_COLORS.profit}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="fecha"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(value) => money(Number(value))}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke={CHART_COLORS.income}
                    fill="url(#incomeGradient)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="ganancia"
                    name="Ganancia"
                    stroke={CHART_COLORS.profit}
                    fill="url(#profitGradient)"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="costos"
                    name="Costos"
                    stroke={CHART_COLORS.cost}
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Margen por fecha
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[360px]">
            {financialByDate.length === 0 ? (
              <EmptyState text="No hay margen para mostrar." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialByDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="fecha"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Productos más rentables
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosMayorGanancia.length === 0 ? (
              <EmptyState text="Todavía no hay ventas para calcular rentabilidad." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
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
                    {productosMayorGanancia.map((product, index) => (
                      <TableRow key={product.sku}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.nombre}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {product.sku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{product.cantidadVendida}</TableCell>
                        <TableCell>{money(product.ingresoTotal)}</TableCell>
                        <TableCell>{money(product.costoTotal)}</TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {money(product.gananciaTotal)}
                        </TableCell>
                        <TableCell>{marginBadge(product.margen)}</TableCell>
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
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Baja rentabilidad
            </CardTitle>
          </CardHeader>

          <CardContent>
            {productosBajaRentabilidad.length === 0 ? (
              <EmptyState text="No hay productos con rentabilidad baja en este periodo." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="racknova-table-header">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Ingresos</TableHead>
                      <TableHead>Costos</TableHead>
                      <TableHead>Ganancia</TableHead>
                      <TableHead>Margen</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {productosBajaRentabilidad.map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.nombre}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {product.sku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{money(product.ingresoTotal)}</TableCell>
                        <TableCell>{money(product.costoTotal)}</TableCell>
                        <TableCell
                          className={
                            product.gananciaTotal >= 0
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {money(product.gananciaTotal)}
                        </TableCell>
                        <TableCell>{marginBadge(product.margen)}</TableCell>
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
            <Activity className="h-5 w-5" />
            Histórico financiero
          </CardTitle>
        </CardHeader>

        <CardContent>
          {historicalFinancialRows.length === 0 ? (
            <EmptyState text="No hay ventas financieras en este periodo." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="racknova-table-header">
                  <TableRow>
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
                  {historicalFinancialRows.map((movement) => {
                    const ingreso = Number(movement.ingreso_total ?? 0);
                    const costo = Number(movement.costo_total ?? 0);
                    const ganancia = ingreso - costo;
                    const margen = getMargin(ingreso, ganancia);

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>{formatDate(movement.timestamp)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {movement.productName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {movement.productSku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {money(ingreso)}
                        </TableCell>
                        <TableCell className="font-semibold text-orange-600">
                          {money(costo)}
                        </TableCell>
                        <TableCell
                          className={
                            ganancia >= 0
                              ? "font-semibold text-blue-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {money(ganancia)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {ganancia >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            )}
                            {percent(margen)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {ventasFiltradas.length > 50 && (
                <p className="text-xs text-muted-foreground p-3">
                  Mostrando las 50 ventas más recientes del periodo.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="racknova-card border-blue-200 dark:border-blue-900">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <p className="font-semibold">Cálculo financiero usado</p>
              <p className="text-sm text-muted-foreground mt-1">
                La ganancia neta del periodo se calcula como ingresos totales
                menos costos totales. El margen se calcula como ganancia
                dividida entre ingresos. La recuperación de inversión usa todo
                el historial: inversión acumulada de ingresos de inventario
                contra capital recuperado por productos vendidos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
