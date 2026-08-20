import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { canModifyInventory, isAdmin } from "@/lib/roles";
import { apiFetch } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useInventory } from "@/context/InventoryContext";
import { useReports, ReportPeriod } from "@/hooks/useReports";

import { SlotGrid } from "./SlotGrid";
import { RealTimeCharts } from "./RealTimeCharts";
import { Location, Product, Rack, Nivel } from "@/types/inventory";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Cloud,
  Download,
  FileText,
  Layers3,
  LocateFixed,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  WalletCards,
  WifiOff,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { publishMQTT } from "@/mqtt/mqttClient";

type RuntimeSummary = {
  loading: boolean;
  reachable: boolean;
  mode: "cloud" | "local" | "unknown";
  localActive: boolean;
  pending: number;
  errorCount: number;
  lastCheckedAt: Date | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const isSameDay = (value: Date, reference: Date) =>
  value.getFullYear() === reference.getFullYear() &&
  value.getMonth() === reference.getMonth() &&
  value.getDate() === reference.getDate();

const startOfDaysAgo = (days: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};

const daysUntil = (dateValue?: string | null) => {
  if (!dateValue) return null;

  const target = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
};

const metricCardClass =
  "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg";

export function InventoryDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { downloadPDF, downloadExcel } = useReports();

  const [selectedRack, setSelectedRack] = useState<Rack>("A");
  const [systemState, setSystemState] = useState<
    "admitido" | "restringido" | null
  >(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchProduct, setSelectedSearchProduct] =
    useState<Product | null>(null);
  const [locatingSku, setLocatingSku] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeSummary>({
    loading: true,
    reachable: false,
    mode: "unknown",
    localActive: false,
    pending: 0,
    errorCount: 0,
    lastCheckedAt: null,
  });

  const {
    products,
    movements,
    locations,
    getTotalProducts,
    getLowStockProducts,
    getProductByLocation,
    buscarFisicamente,
  } = useInventory();

  const canModify = canModifyInventory();
  const canSeeMasterReport = isAdmin();

  const now = new Date();
  const userName =
    localStorage.getItem("nombre") ||
    localStorage.getItem("usuario") ||
    "equipo RackNova";

  const totalSlots = locations.filter(
    (location) => location.rack === selectedRack
  ).length;

  const occupiedSlots = locations
    .filter((location) => location.rack === selectedRack)
    .filter((location) => getProductByLocation(location.id)).length;

  const freeSlots = totalSlots - occupiedSlots;
  const occupancyPercentage =
    totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  const getNivelStats = (nivel: Nivel) => {
    const nivelLocations = locations.filter(
      (location) => location.rack === selectedRack && location.nivel === nivel
    );

    const occupiedInNivel = nivelLocations.filter((location) =>
      getProductByLocation(location.id)
    ).length;

    return {
      total: nivelLocations.length,
      occupied: occupiedInNivel,
      free: nivelLocations.length - occupiedInNivel,
    };
  };

  const todayMovements = useMemo(
    () =>
      movements.filter((movement) =>
        isSameDay(new Date(movement.timestamp), now)
      ),
    [movements]
  );

  const todaySales = useMemo(
    () => todayMovements.filter((movement) => movement.action === "Egreso"),
    [todayMovements]
  );

  const todayIncome = useMemo(
    () =>
      todaySales.reduce(
        (total, movement) => total + Number(movement.ingreso_total ?? 0),
        0
      ),
    [todaySales]
  );

  const todayProfit = useMemo(
    () =>
      todaySales.reduce(
        (total, movement) => total + Number(movement.ganancia ?? 0),
        0
      ),
    [todaySales]
  );

  const todaySoldUnits = useMemo(
    () =>
      todaySales.reduce(
        (total, movement) => total + Number(movement.quantity ?? 0),
        0
      ),
    [todaySales]
  );

  const totalInventoryUnits = useMemo(
    () =>
      products.reduce(
        (total, product) => total + Number(product.cantidad ?? 0),
        0
      ),
    [products]
  );

  const lowStockProducts = useMemo(
    () =>
      [...getLowStockProducts()].sort(
        (a, b) => Number(a.cantidad ?? 0) - Number(b.cantidad ?? 0)
      ),
    [products]
  );

  const expirationProducts = useMemo(() => {
    return products
      .map((product) => ({
        product,
        days: daysUntil(product.caducidad),
      }))
      .filter(
        (entry): entry is { product: Product; days: number } =>
          entry.days !== null && entry.days <= 30
      )
      .sort((a, b) => a.days - b.days);
  }, [products]);

  const expiredCount = expirationProducts.filter(
    (entry) => entry.days < 0
  ).length;

  const expiringSoonCount = expirationProducts.filter(
    (entry) => entry.days >= 0
  ).length;

  const topSoldProducts = useMemo(() => {
    const from = startOfDaysAgo(30);
    const sales = new Map<
      string,
      { sku: string; name: string; quantity: number; income: number }
    >();

    movements
      .filter(
        (movement) =>
          movement.action === "Egreso" &&
          new Date(movement.timestamp).getTime() >= from.getTime()
      )
      .forEach((movement) => {
        const current = sales.get(movement.productSku) ?? {
          sku: movement.productSku,
          name: movement.productName,
          quantity: 0,
          income: 0,
        };

        current.quantity += Number(movement.quantity ?? 0);
        current.income += Number(movement.ingreso_total ?? 0);
        sales.set(movement.productSku, current);
      });

    return Array.from(sales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [movements]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return products
      .filter(
        (product) =>
          product.sku.toLowerCase().includes(query) ||
          product.nombre.toLowerCase().includes(query) ||
          (product.descripcion ?? "").toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [products, searchQuery]);

  const refreshRuntimeStatus = async () => {
    setRuntime((previous) => ({ ...previous, loading: true }));

    try {
      const [localResult, syncResult] = await Promise.allSettled([
        apiFetch("/local/v1/status"),
        apiFetch("/sync/v1/status"),
      ]);

      let mode: RuntimeSummary["mode"] = "unknown";
      let localActive = false;
      let pending = 0;
      let errorCount = 0;
      let reachable = false;

      if (localResult.status === "fulfilled" && localResult.value.ok) {
        reachable = true;
        const data = await localResult.value.json().catch(() => null);

        if (data?.runtime_mode === "local" || data?.runtime_mode === "cloud") {
          mode = data.runtime_mode;
        }

        localActive = Boolean(data?.local_active);
      }

      if (syncResult.status === "fulfilled" && syncResult.value.ok) {
        reachable = true;
        const data = await syncResult.value.json().catch(() => null);

        if (
          mode === "unknown" &&
          (data?.runtime_mode === "local" || data?.runtime_mode === "cloud")
        ) {
          mode = data.runtime_mode;
        }

        const counts = data?.outbox?.counts ?? {};
        pending = Number(counts?.PENDING ?? 0) + Number(counts?.SENDING ?? 0);
        errorCount = Number(counts?.ERROR ?? 0);
      }

      setRuntime({
        loading: false,
        reachable,
        mode,
        localActive,
        pending,
        errorCount,
        lastCheckedAt: new Date(),
      });
    } catch (error) {
      console.error("No se pudo obtener estado RackNova:", error);
      setRuntime({
        loading: false,
        reachable: false,
        mode: "unknown",
        localActive: false,
        pending: 0,
        errorCount: 0,
        lastCheckedAt: new Date(),
      });
    }
  };

  useEffect(() => {
    void refreshRuntimeStatus();

    const interval = window.setInterval(() => {
      void refreshRuntimeStatus();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const handleSlotInspect = (location: Location, hasProduct: boolean) => {
    const product = getProductByLocation(location.id);

    if (!hasProduct || !product) {
      toast({
        title: `Slot ${location.id}`,
        description: "Este espacio se encuentra libre.",
      });
      return;
    }

    setSelectedSearchProduct(product);
    setSearchQuery(product.sku);

    toast({
      title: product.nombre,
      description: `${product.sku} · ${product.cantidad} unidades · ${location.id}`,
    });
  };

  const selectSearchProduct = (product: Product) => {
    setSelectedSearchProduct(product);
    setSearchQuery(product.nombre);

    const rack = product.locationId.split("-")[0] as Rack;
    if (["A", "B", "C", "D", "E"].includes(rack)) {
      setSelectedRack(rack);
    }
  };

  const handleLocateProduct = async (product: Product) => {
    setLocatingSku(product.sku);

    try {
      const result = await buscarFisicamente(product.locationId);

      toast({
        title: result.ok ? "Producto localizado" : "No se pudo localizar",
        description: result.mensaje,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error buscando producto:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la búsqueda física.",
        variant: "destructive",
      });
    } finally {
      setLocatingSku(null);
    }
  };

  const handleAdmitir = () => {
    publishMQTT("Entrada/admision", "8113");
    setSystemState("admitido");

    toast({
      title: "Sistema admitido",
      description: "Se envió el comando ADMITIDO al rack.",
    });
  };

  const handleRestringir = () => {
    publishMQTT("Entrada/admision", "0");
    setSystemState("restringido");

    toast({
      title: "Sistema restringido",
      description: "Se envió el comando RESTRINGIDO al rack.",
    });
  };

  const getReportPeriodLabel = (period: ReportPeriod) => {
    if (period === "7d") return "Últimos 7 días";
    if (period === "30d") return "Últimos 30 días";
    if (period === "month") return "Mes actual";
    if (period === "year") return "Año actual";
    return "Todo el historial";
  };

  const operationalAlerts = [
    lowStockProducts.length > 0
      ? {
          key: "low-stock",
          icon: AlertTriangle,
          title: `${lowStockProducts.length} productos con stock bajo`,
          description:
            lowStockProducts
              .slice(0, 2)
              .map((product) => product.nombre)
              .join(", ") || "Revisa inventario crítico.",
          tone: "amber",
          action: () => navigate("/products"),
        }
      : null,
    expiredCount > 0
      ? {
          key: "expired",
          icon: CalendarClock,
          title: `${expiredCount} productos con caducidad vencida`,
          description: "Requieren revisión inmediata.",
          tone: "red",
          action: () => navigate("/products"),
        }
      : null,
    expiringSoonCount > 0
      ? {
          key: "expiring",
          icon: CalendarClock,
          title: `${expiringSoonCount} productos próximos a caducar`,
          description: "Caducidad dentro de los próximos 30 días.",
          tone: "purple",
          action: () => navigate("/products"),
        }
      : null,
    runtime.pending > 0
      ? {
          key: "sync-pending",
          icon: RefreshCw,
          title: `${runtime.pending} cambios pendientes de sincronizar`,
          description: "RackNova Local conservará los cambios hasta sincronizar.",
          tone: "blue",
          action: refreshRuntimeStatus,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof AlertTriangle;
    title: string;
    description: string;
    tone: string;
    action: () => void;
  }>;

  const reportControls = canSeeMasterReport ? (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={reportPeriod}
        onValueChange={(value) => setReportPeriod(value as ReportPeriod)}
      >
        <SelectTrigger className="h-10 w-full border-slate-200 bg-white text-slate-900 shadow-sm sm:w-48 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur dark:[&>svg]:text-white">
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="month">Mes actual</SelectItem>
          <SelectItem value="year">Año actual</SelectItem>
          <SelectItem value="all">Todo el historial</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-10 border border-slate-200 bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:border-white/20 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90">
            <Download className="mr-2 h-4 w-4" />
            Reporte maestro
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => downloadPDF(reportPeriod)}>
            <FileText className="mr-2 h-4 w-4" />
            Descargar PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadExcel(reportPeriod)}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-6 text-slate-950 shadow-xl shadow-slate-200/40 transition-colors sm:px-7 lg:px-9 lg:py-8 dark:border-slate-800/10 dark:bg-gradient-to-br dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white dark:shadow-2xl dark:shadow-blue-950/15">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl dark:bg-cyan-400/10" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-500/15" />

        <div className="relative grid gap-7 xl:grid-cols-[1.4fr_0.6fr] xl:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Centro operativo RackNova
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <CircleDot className="h-3 w-3 text-emerald-400" />
                Datos en tiempo real
              </span>
            </div>

            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-100/90">
              {getGreeting()}, {userName}
            </p>

            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Tu operación, clara y bajo control.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
              Inventario, ventas, alertas y estado del sistema en una sola vista.
              El Dashboard ahora funciona como centro de monitoreo y localización,
              sin mezclar altas ni salidas de inventario.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
              <span>
                {now.toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500" />
              <span>Reporte: {getReportPeriodLabel(reportPeriod)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            {reportControls}

            <div className="grid w-full gap-2 sm:grid-cols-3 xl:max-w-xl">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 hover:text-slate-950 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => navigate("/products")}
              >
                <Package className="mr-2 h-4 w-4" />
                Productos
              </Button>

              {canModify && (
                <>
                  <Button
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 hover:text-slate-950 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => navigate("/pos")}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Punto de venta
                  </Button>

                  <Button
                    className="bg-cyan-500 text-slate-950 shadow-sm hover:bg-cyan-400 dark:bg-cyan-400 dark:hover:bg-cyan-300"
                    onClick={() => navigate("/add")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={metricCardClass}>
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-cyan-300">
                <WalletCards className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hoy
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Ventas
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              {money(todayIncome)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {todaySoldUnits} unidades vendidas
            </p>
          </div>
        </div>

        <div className={metricCardClass}>
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-300">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hoy
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Ganancia
            </p>
            <p
              className={`mt-1 text-2xl font-black tracking-tight ${
                todayProfit >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {money(todayProfit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              resultado de salidas registradas
            </p>
          </div>
        </div>

        <div className={metricCardClass}>
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-600 dark:text-cyan-300">
                <Boxes className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Inventario
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Existencias
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              {totalInventoryUnits.toLocaleString("es-MX")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getTotalProducts()} productos activos
            </p>
          </div>
        </div>

        <div className={metricCardClass}>
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Atención
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Stock bajo
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight text-amber-600">
              {lowStockProducts.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              productos por reabastecer
            </p>
          </div>
        </div>

        <div className={metricCardClass}>
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600 dark:text-violet-300">
                <CalendarClock className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                30 días
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Caducidades
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              {expirationProducts.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {expiredCount > 0
                ? `${expiredCount} ya vencidos`
                : "sin vencidos detectados"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.75fr]">
        <Card className="racknova-card overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" />
                  Localizar producto
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Busca por SKU, nombre o descripción y ubícalo en el rack.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <LocateFixed className="h-3.5 w-3.5" />
                Búsqueda física
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedSearchProduct(null);
                }}
                placeholder="Ej. SKU-001, Coca Cola, refacción..."
                className="h-11 pl-9"
              />

              {searchQuery.trim() && !selectedSearchProduct && (
                <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-2xl">
                  {searchResults.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No encontramos productos con esa búsqueda.
                    </p>
                  ) : (
                    searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => selectSearchProduct(product)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {product.nombre}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.sku} · {product.locationId}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedSearchProduct ? (
              <div className="mt-4 grid gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{selectedSearchProduct.nombre}</p>
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                      {selectedSearchProduct.sku}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      Ubicación:{" "}
                      <strong className="text-foreground">
                        {selectedSearchProduct.locationId}
                      </strong>
                    </span>
                    <span>
                      Stock:{" "}
                      <strong className="text-foreground">
                        {selectedSearchProduct.cantidad}
                      </strong>
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleLocateProduct(selectedSearchProduct)}
                  disabled={locatingSku === selectedSearchProduct.sku}
                  className="h-10"
                >
                  {locatingSku === selectedSearchProduct.sku ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="mr-2 h-4 w-4" />
                  )}
                  Buscar físicamente
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <PackageCheck className="h-5 w-5 text-primary" />
                El Dashboard ya no modifica inventario: aquí monitoreas y
                localizas; las altas están en Agregar y las salidas en Productos.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-primary" />
                  Estado del sistema
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Infraestructura RackNova
                </p>
              </div>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => void refreshRuntimeStatus()}
                disabled={runtime.loading}
                aria-label="Actualizar estado"
              >
                <RefreshCw
                  className={`h-4 w-4 ${runtime.loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    runtime.reachable
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {runtime.reachable ? (
                    runtime.mode === "local" ? (
                      <Server className="h-4 w-4" />
                    ) : (
                      <Cloud className="h-4 w-4" />
                    )
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {runtime.mode === "local"
                      ? "Servidor RackNova Local"
                      : runtime.mode === "cloud"
                        ? "RackNova Cloud"
                        : "Backend RackNova"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {runtime.reachable ? "Operativo" : "Sin respuesta"}
                  </p>
                </div>
              </div>

              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  runtime.reachable ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-cyan-300">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Sincronización</p>
                  <p className="text-xs text-muted-foreground">
                    {runtime.pending === 0
                      ? "Sin cambios pendientes"
                      : `${runtime.pending} cambios pendientes`}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold ${
                  runtime.pending === 0
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {runtime.pending === 0 ? "AL DÍA" : "PENDIENTE"}
              </span>
            </div>

            {runtime.errorCount > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                Historial de Sync: {runtime.errorCount} eventos marcados como
                ERROR.
              </div>
            )}

            <p className="px-1 text-[11px] text-muted-foreground">
              Última revisión:{" "}
              {runtime.lastCheckedAt
                ? runtime.lastCheckedAt.toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "pendiente"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.75fr]">
        <RealTimeCharts />

        <div className="space-y-4">
          <Card className="racknova-card overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Atención requerida</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prioridades operativas detectadas
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    operationalAlerts.length === 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {operationalAlerts.length === 0
                    ? "Todo bien"
                    : operationalAlerts.length}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 pt-4">
              {operationalAlerts.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold">
                      Operación sin alertas críticas
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      No detectamos stock crítico, caducidades próximas ni
                      sincronización pendiente.
                    </p>
                  </div>
                </div>
              ) : (
                operationalAlerts.slice(0, 4).map((alert) => {
                  const Icon = alert.icon;
                  const toneClass =
                    alert.tone === "red"
                      ? "bg-red-500/10 text-red-600"
                      : alert.tone === "amber"
                        ? "bg-amber-500/10 text-amber-600"
                        : alert.tone === "purple"
                          ? "bg-violet-500/10 text-violet-600"
                          : "bg-blue-500/10 text-blue-600";

                  return (
                    <button
                      key={alert.key}
                      type="button"
                      onClick={alert.action}
                      className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={`rounded-lg p-2 ${toneClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {alert.description}
                        </p>
                      </div>

                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Más vendidos
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Últimos 30 días
              </p>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              {topSoldProducts.length === 0 ? (
                <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  Aún no hay ventas suficientes para mostrar ranking.
                </p>
              ) : (
                topSoldProducts.map((item, index) => (
                  <div
                    key={item.sku}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.sku} · {money(item.income)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black">{item.quantity}</p>
                      <p className="text-[11px] text-muted-foreground">uds.</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="racknova-card overflow-hidden rounded-2xl">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers3 className="h-5 w-5 text-primary" />
                  Mapa físico · Rack {selectedRack}
                </CardTitle>

                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {occupancyPercentage}% ocupado
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Vista de monitoreo. Haz clic en un slot para consultar su
                producto; usa el botón de localización para buscarlo físicamente.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {canModify && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={systemState === "admitido" ? "default" : "outline"}
                    onClick={handleAdmitir}
                    className={
                      systemState === "admitido"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : ""
                    }
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Admitir
                  </Button>

                  <Button
                    size="sm"
                    variant={
                      systemState === "restringido" ? "destructive" : "outline"
                    }
                    onClick={handleRestringir}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Restringir
                  </Button>
                </div>
              )}

              <div className="w-full sm:w-44">
                <Select
                  value={selectedRack}
                  onValueChange={(value) => setSelectedRack(value as Rack)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona rack" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Rack A</SelectItem>
                    <SelectItem value="B">Rack B</SelectItem>
                    <SelectItem value="C">Rack C</SelectItem>
                    <SelectItem value="D">Rack D</SelectItem>
                    <SelectItem value="E">Rack E</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((nivel) => {
              const stats = getNivelStats(nivel as Nivel);
              const pct =
                stats.total > 0
                  ? Math.round((stats.occupied / stats.total) * 100)
                  : 0;

              return (
                <div
                  key={nivel}
                  className="rounded-xl border bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Nivel {nivel}</p>
                    <span className="text-xs font-bold text-primary">{pct}%</span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.occupied} ocupados · {stats.free} libres
                  </p>
                </div>
              );
            })}
          </div>

          <div className="space-y-7">
            {[1, 2, 3].map((nivel) => {
              const stats = getNivelStats(nivel as Nivel);

              return (
                <div key={nivel} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Nivel {nivel}</h3>
                      <p className="text-xs text-muted-foreground">
                        {stats.occupied} ocupados de {stats.total}
                      </p>
                    </div>

                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {stats.free} libres
                    </span>
                  </div>

                  <SlotGrid
                    rack={selectedRack}
                    nivel={nivel as Nivel}
                    onSlotClick={handleSlotInspect}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-7 flex flex-wrap gap-3 rounded-xl border bg-muted/30 p-4">
            {[
              ["bg-green-500", "Libre"],
              ["bg-yellow-400", "Colocando"],
              ["bg-red-500", "Ocupado"],
              ["bg-purple-500", "Quitando"],
            ].map(([color, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-2 text-xs font-medium"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                {label}
              </div>
            ))}

            <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
              <PackageCheck className="h-4 w-4" />
              {occupiedSlots} ocupados · {freeSlots} libres
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
