import React, { useMemo, useState } from "react";
import { API_URL } from "@/config";
import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  Brain,
  Boxes,
  CalendarClock,
  TrendingDown,
  TrendingUp,
  PackageX,
  Target,
  Percent,
  MapPinned,
  ShoppingCart,
  Download,
  MessageSquare,
  RefreshCcw,
  Zap,
  ShieldAlert,
  Lightbulb,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string | null;
  warning?: string | null;
};

type PriorityLevel = "Alta" | "Media" | "Monitoreo";

type ProductAnalysis = {
  sku: string;
  nombre: string;
  locationId: string;
  cantidad: number;
  stockMinimo: number;
  stockAlto: number;
  caducidad: string | null;
  diasCaducidad: number | null;
  cantidadVendida: number;
  ingresos: number;
  costos: number;
  ganancia: number;
  margen: number;
  descuentoSugerido: number;
  stockStatus: "bajo" | "normal" | "alto";
  score: number;
  prioridad: PriorityLevel;
  razones: string[];
};

const CHART_COLORS = {
  primary: "#2563eb",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  slate: "#64748b",
};

const PRIORITY_COLORS = ["#ef4444", "#f59e0b", "#2563eb"];
const STOCK_COLORS = ["#ef4444", "#10b981", "#2563eb"];

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

const quickQuestions = [
  {
    title: "Descuentos",
    prompt: "¿Qué productos me recomiendas vender con descuento y por qué?",
    icon: Percent,
  },
  {
    title: "Caducidad",
    prompt: "¿Qué productos están próximos a caducar y qué debo hacer?",
    icon: CalendarClock,
  },
  {
    title: "Restock",
    prompt: "¿Qué productos debo resurtir primero según mi inventario?",
    icon: Boxes,
  },
  {
    title: "Baja rotación",
    prompt: "¿Qué productos tienen baja rotación o no se han vendido?",
    icon: TrendingDown,
  },
  {
    title: "Rentabilidad",
    prompt: "¿Qué productos son más rentables y cuáles tienen margen bajo?",
    icon: TrendingUp,
  },
  {
    title: "Ubicación",
    prompt: "¿Qué productos me conviene mover de ubicación dentro del rack?",
    icon: MapPinned,
  },
];

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

function formatDate(value?: string | null) {
  if (!value) return "Sin caducidad";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysToExpiration(dateValue?: string | null) {
  if (!dateValue) return null;

  const expirationDate = new Date(`${dateValue.slice(0, 10)}T00:00:00`);

  const today = new Date();
  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs = expirationDate.getTime() - todayClean.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getSuggestedDiscount(days: number | null) {
  if (days === null) return 0;
  if (days < 0) return 0;
  if (days <= 5) return 40;
  if (days <= 10) return 30;
  if (days <= 15) return 20;
  if (days <= 30) return 10;

  return 0;
}

function getStockStatus(product: Product): "bajo" | "normal" | "alto" {
  const stockMinimo = Number(product.stock_minimo ?? 10);
  const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);

  if (product.cantidad <= stockMinimo) return "bajo";
  if (product.cantidad >= stockAlto) return "alto";

  return "normal";
}

function getPriorityBadge(priority: PriorityLevel) {
  if (priority === "Alta") {
    return <Badge variant="destructive">Prioridad alta</Badge>;
  }

  if (priority === "Media") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Prioridad media</Badge>;
  }

  return <Badge className="bg-blue-600 hover:bg-blue-600">Monitoreo</Badge>;
}

function getStockBadge(status: "bajo" | "normal" | "alto") {
  if (status === "bajo") return <Badge variant="destructive">Stock bajo</Badge>;

  if (status === "alto") {
    return <Badge className="bg-blue-600 hover:bg-blue-600">Stock alto</Badge>;
  }

  return <Badge variant="outline">Stock normal</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function productTooltipLabel(_label: unknown, payload: any[]) {
  const item = payload?.[0]?.payload;

  return item?.nombre || item?.sku || "Producto";
}

export default function RackNovaIA() {
  const { products, movements } = useInventory();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola, soy RACKNOVA IA. Puedo ayudarte a analizar inventario, caducidad, descuentos, rotación, rentabilidad, stock y ubicación de productos.",
      source: "racknova",
    },
  ]);

  const productAnalysis = useMemo<ProductAnalysis[]>(() => {
    const salesMap = new Map<
      string,
      {
        cantidadVendida: number;
        ingresos: number;
        costos: number;
        ganancia: number;
      }
    >();

    movements
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const current =
          salesMap.get(movement.productSku) ??
          {
            cantidadVendida: 0,
            ingresos: 0,
            costos: 0,
            ganancia: 0,
          };

        const ingreso = Number(movement.ingreso_total ?? 0);
        const costo = Number(movement.costo_total ?? 0);
        const ganancia = ingreso - costo;

        current.cantidadVendida += Number(movement.quantity ?? 0);
        current.ingresos += ingreso;
        current.costos += costo;
        current.ganancia += ganancia;

        salesMap.set(movement.productSku, current);
      });

    return products.map((product) => {
      const sales = salesMap.get(product.sku);
      const stockMinimo = Number(product.stock_minimo ?? 10);
      const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);
      const diasCaducidad = getDaysToExpiration(product.caducidad);
      const descuentoSugerido = getSuggestedDiscount(diasCaducidad);
      const stockStatus = getStockStatus(product);

      const ingresos = Number(sales?.ingresos ?? 0);
      const costos = Number(sales?.costos ?? 0);
      const ganancia = Number(sales?.ganancia ?? 0);
      const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;
      const cantidadVendida = Number(sales?.cantidadVendida ?? 0);

      const razones: string[] = [];
      let score = 0;

      if (stockStatus === "bajo") {
        score += 25;
        razones.push("stock bajo");
      }

      if (diasCaducidad !== null && diasCaducidad < 0) {
        score += 40;
        razones.push("producto vencido");
      } else if (diasCaducidad !== null && diasCaducidad <= 7) {
        score += 30;
        razones.push("caducidad muy cercana");
      } else if (diasCaducidad !== null && diasCaducidad <= 15) {
        score += 25;
        razones.push("caducidad cercana");
      } else if (diasCaducidad !== null && diasCaducidad <= 30) {
        score += 15;
        razones.push("próximo a caducar");
      }

      if (cantidadVendida === 0 && product.cantidad > 0) {
        score += 20;
        razones.push("sin ventas registradas");
      }

      if (ingresos > 0 && margen < 15) {
        score += 15;
        razones.push("margen bajo");
      }

      if (stockStatus === "alto" && cantidadVendida === 0) {
        score += 10;
        razones.push("stock alto sin movimiento");
      }

      const prioridad: PriorityLevel =
        score >= 50 ? "Alta" : score >= 25 ? "Media" : "Monitoreo";

      return {
        sku: product.sku,
        nombre: product.nombre,
        locationId: product.locationId,
        cantidad: product.cantidad,
        stockMinimo,
        stockAlto,
        caducidad: product.caducidad ?? null,
        diasCaducidad,
        cantidadVendida,
        ingresos,
        costos,
        ganancia,
        margen,
        descuentoSugerido,
        stockStatus,
        score,
        prioridad,
        razones,
      };
    });
  }, [products, movements]);

  const priorityProducts = useMemo(() => {
    return [...productAnalysis].sort((a, b) => b.score - a.score).slice(0, 10);
  }, [productAnalysis]);

  const discountProducts = useMemo(() => {
    return productAnalysis
      .filter((product) => product.descuentoSugerido > 0)
      .sort((a, b) => {
        const aDays = a.diasCaducidad ?? 999999;
        const bDays = b.diasCaducidad ?? 999999;

        return aDays - bDays;
      })
      .slice(0, 10);
  }, [productAnalysis]);

  const lowStockProducts = useMemo(() => {
    return productAnalysis
      .filter((product) => product.stockStatus === "bajo")
      .sort((a, b) => a.cantidad - b.cantidad)
      .slice(0, 10);
  }, [productAnalysis]);

  const notSoldProducts = useMemo(() => {
    return productAnalysis
      .filter((product) => product.cantidadVendida === 0)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [productAnalysis]);

  const lowMarginProducts = useMemo(() => {
    return productAnalysis
      .filter((product) => product.ingresos > 0 && product.margen < 15)
      .sort((a, b) => a.margen - b.margen)
      .slice(0, 10);
  }, [productAnalysis]);

  const summary = useMemo(() => {
    const highPriority = productAnalysis.filter(
      (product) => product.prioridad === "Alta"
    ).length;

    const mediumPriority = productAnalysis.filter(
      (product) => product.prioridad === "Media"
    ).length;

    const stockLow = productAnalysis.filter(
      (product) => product.stockStatus === "bajo"
    ).length;

    const expiring = productAnalysis.filter(
      (product) =>
        product.diasCaducidad !== null &&
        product.diasCaducidad >= 0 &&
        product.diasCaducidad <= 30
    ).length;

    const expired = productAnalysis.filter(
      (product) =>
        product.diasCaducidad !== null && product.diasCaducidad < 0
    ).length;

    const notSold = productAnalysis.filter(
      (product) => product.cantidadVendida === 0
    ).length;

    const lowMargin = productAnalysis.filter(
      (product) => product.ingresos > 0 && product.margen < 15
    ).length;

    const totalPotentialDiscounts = discountProducts.length;

    return {
      totalProducts: productAnalysis.length,
      highPriority,
      mediumPriority,
      stockLow,
      expiring,
      expired,
      notSold,
      lowMargin,
      totalPotentialDiscounts,
    };
  }, [productAnalysis, discountProducts.length]);

  const priorityChartData = useMemo(() => {
    return [
      {
        name: "Alta",
        value: productAnalysis.filter((p) => p.prioridad === "Alta").length,
      },
      {
        name: "Media",
        value: productAnalysis.filter((p) => p.prioridad === "Media").length,
      },
      {
        name: "Monitoreo",
        value: productAnalysis.filter((p) => p.prioridad === "Monitoreo").length,
      },
    ];
  }, [productAnalysis]);

  const stockChartData = useMemo(() => {
    return [
      {
        name: "Bajo",
        value: productAnalysis.filter((p) => p.stockStatus === "bajo").length,
      },
      {
        name: "Normal",
        value: productAnalysis.filter((p) => p.stockStatus === "normal").length,
      },
      {
        name: "Alto",
        value: productAnalysis.filter((p) => p.stockStatus === "alto").length,
      },
    ];
  }, [productAnalysis]);

  const priorityBarData = useMemo(() => {
    return priorityProducts.slice(0, 8).map((product) => ({
      sku: product.sku,
      nombre: product.nombre,
      score: product.score,
    }));
  }, [priorityProducts]);

  const executiveMessage = useMemo(() => {
    if (productAnalysis.length === 0) {
      return "Todavía no hay productos suficientes para generar análisis inteligente.";
    }

    if (summary.highPriority > 0) {
      return `RACKNOVA IA detectó ${summary.highPriority} producto(s) con prioridad alta. Revisa primero caducidad, stock bajo, baja rotación y margen bajo.`;
    }

    if (summary.mediumPriority > 0) {
      return `El inventario se mantiene estable, pero hay ${summary.mediumPriority} producto(s) que requieren monitoreo preventivo.`;
    }

    return "El inventario se ve estable. No hay riesgos críticos detectados en este momento.";
  }, [productAnalysis.length, summary.highPriority, summary.mediumPriority]);

  const askIA = async (customQuestion?: string) => {
    const preguntaFinal = (customQuestion ?? question).trim();

    if (!preguntaFinal || loading) return;

    const userMessage: Message = {
      role: "user",
      content: preguntaFinal,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/ia/inventario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pregunta: preguntaFinal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "No se pudo obtener respuesta de RACKNOVA IA."
        );
      }

      const assistantMessage: Message = {
        role: "assistant",
        content:
          data?.respuesta ||
          "RACKNOVA IA no generó una respuesta. Intenta con otra pregunta.",
        source: data?.fuente ?? data?.modelo ?? "racknova",
        warning: data?.advertencia ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.message ||
            "Ocurrió un error conectando con RACKNOVA IA. Revisa el backend.",
          source: "error",
          warning: "No se pudo completar la consulta.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat reiniciado. Pregúntame sobre inventario, descuentos, caducidad, ubicación, ventas, rentabilidad o restock.",
        source: "racknova",
      },
    ]);
  };

  const exportCSV = () => {
    const headers = [
      "SKU",
      "Producto",
      "Ubicacion",
      "Cantidad",
      "Stock minimo",
      "Stock alto",
      "Stock status",
      "Caducidad",
      "Dias caducidad",
      "Vendidas",
      "Ingresos",
      "Costos",
      "Ganancia",
      "Margen",
      "Descuento sugerido",
      "Prioridad",
      "Score",
      "Razones",
    ];

    const rows = productAnalysis.map((product) => [
      product.sku,
      product.nombre,
      product.locationId,
      product.cantidad,
      product.stockMinimo,
      product.stockAlto,
      product.stockStatus,
      product.caducidad ?? "",
      product.diasCaducidad ?? "",
      product.cantidadVendida,
      product.ingresos,
      product.costos,
      product.ganancia,
      product.margen,
      product.descuentoSugerido,
      product.prioridad,
      product.score,
      product.razones.join(" | "),
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
    link.download = `racknova-ia-analisis-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-slate-100 text-slate-950 shadow-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/30" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl dark:bg-emerald-500/20" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm border border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-blue-50">
                <Bot className="h-4 w-4" />
                Centro inteligente RackNova
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                  RackNova IA
                  <Sparkles className="h-8 w-8 text-blue-600 dark:text-cyan-300" />
                </h1>

                <p className="text-slate-600 mt-2 max-w-2xl dark:text-blue-100">
                  Análisis inteligente de inventario, caducidad, rotación,
                  rentabilidad, descuentos, ubicación y restock.
                </p>
              </div>

              <div className="rounded-xl bg-white/75 border border-slate-200 p-4 max-w-3xl dark:bg-white/10 dark:border-white/15">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {executiveMessage}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[220px]">
              <Button
                onClick={exportCSV}
                className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar análisis
              </Button>

              <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
                <p className="text-sm text-slate-500 dark:text-blue-100">
                  Productos analizados
                </p>
                <p className="text-3xl font-bold">{summary.totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Prioridad alta
              </p>
              <p className="text-2xl font-bold text-red-600">
                {summary.highPriority}
              </p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Próximos a caducar
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {summary.expiring}
              </p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Sin ventas
              </p>
              <p className="text-2xl font-bold text-sky-600">
                {summary.notSold}
              </p>
            </div>

            <div className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Margen bajo
              </p>
              <p className="text-2xl font-bold text-orange-600">
                {summary.lowMargin}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock bajo</p>
                <p className="text-3xl font-bold text-red-600">
                  {summary.stockLow}
                </p>
              </div>
              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-3xl font-bold text-red-600">
                  {summary.expired}
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
                  Descuentos sugeridos
                </p>
                <p className="text-3xl font-bold text-amber-600">
                  {summary.totalPotentialDiscounts}
                </p>
              </div>
              <Percent className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Prioridad media
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  {summary.mediumPriority}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="racknova-card xl:col-span-2">
  <CardHeader>
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          Productos con mayor prioridad IA
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Los puntos IA indican qué tan urgente es revisar un producto. Entre más
          alto sea el puntaje, mayor prioridad tiene.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="destructive">Alta: 50+ pts</Badge>
        <Badge className="bg-amber-500 hover:bg-amber-500">
          Media: 25-49 pts
        </Badge>
        <Badge className="bg-blue-600 hover:bg-blue-600">
          Monitoreo: 0-24 pts
        </Badge>
      </div>
    </div>
  </CardHeader>

  <CardContent className="space-y-4">
    <div className="h-[300px]">
      {priorityBarData.length === 0 ? (
        <EmptyState text="No hay datos suficientes para generar prioridades." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={priorityBarData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="sku"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8" }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelFormatter={productTooltipLabel}
              formatter={(value) => [
                `${numberFormat(Number(value))} puntos`,
                "Prioridad IA",
              ]}
            />
            <Bar
              dataKey="score"
              name="Prioridad IA"
              fill={CHART_COLORS.primary}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>

    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="font-semibold mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        ¿Cómo se calculan los puntos IA?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Producto vencido</span>
          <span className="font-bold text-red-600">+40 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Caducidad menor o igual a 7 días</span>
          <span className="font-bold text-red-600">+30 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Caducidad menor o igual a 15 días</span>
          <span className="font-bold text-amber-600">+25 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Stock bajo</span>
          <span className="font-bold text-red-600">+25 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Producto sin ventas registradas</span>
          <span className="font-bold text-sky-600">+20 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Margen bajo</span>
          <span className="font-bold text-orange-600">+15 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Próximo a caducar, hasta 30 días</span>
          <span className="font-bold text-amber-600">+15 pts</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background border p-3">
          <span>Stock alto sin movimiento</span>
          <span className="font-bold text-blue-600">+10 pts</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Un producto puede acumular varios puntos si tiene más de un problema, por
        ejemplo: stock bajo, caducidad cercana y baja rotación.
      </p>
    </div>
  </CardContent>
</Card>

          <CardContent className="h-[340px]">
            {priorityBarData.length === 0 ? (
              <EmptyState text="No hay datos suficientes para generar prioridades." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="sku"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={productTooltipLabel}
                    formatter={(value) => [
                      `${numberFormat(Number(value))} puntos`,
                      "Prioridad IA",
                    ]}
                  />
                  <Bar
                    dataKey="score"
                    name="Prioridad IA"
                    fill={CHART_COLORS.primary}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Distribución de prioridad
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={105}
                  paddingAngle={4}
                  label
                >
                  {priorityChartData.map((_, index) => (
                    <Cell
                      key={`priority-cell-${index}`}
                      fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]}
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="racknova-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Decisiones recomendadas
            </CardTitle>
          </CardHeader>

          <CardContent>
            {priorityProducts.length === 0 ? (
              <EmptyState text="No hay recomendaciones disponibles." />
            ) : (
              <div className="space-y-3">
                {priorityProducts.slice(0, 8).map((product) => (
                  <div
                    key={product.sku}
                    className="rounded-xl border p-4 bg-background hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{product.nombre}</p>
                          {getPriorityBadge(product.prioridad)}
                          {getStockBadge(product.stockStatus)}
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">
                          SKU {product.sku} · Ubicación {product.locationId} ·
                          Stock {product.cantidad}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {product.razones.length === 0 ? (
                            <Badge variant="outline">Sin riesgo crítico</Badge>
                          ) : (
                            product.razones.map((reason) => (
                              <Badge key={reason} variant="outline">
                                {reason}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="text-sm md:text-right">
                        <p className="text-muted-foreground">Score IA</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {product.score}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Caducidad</p>
                        <p className="font-semibold">{formatDate(product.caducidad)}</p>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Vendidas</p>
                        <p className="font-semibold">{product.cantidadVendida}</p>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Margen</p>
                        <p
                          className={`font-semibold ${
                            product.margen < 15 && product.ingresos > 0
                              ? "text-orange-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {product.ingresos > 0 ? percent(product.margen) : "-"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Descuento</p>
                        <p className="font-semibold text-amber-600">
                          {product.descuentoSugerido > 0
                            ? `${product.descuentoSugerido}% sugerido`
                            : "No requerido"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-emerald-600" />
              Estado de stock
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={105}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Descuentos sugeridos por caducidad
            </CardTitle>
          </CardHeader>

          <CardContent>
            {discountProducts.length === 0 ? (
              <EmptyState text="No hay productos que requieran descuento por caducidad." />
            ) : (
              <div className="space-y-3">
                {discountProducts.map((product) => (
                  <div
                    key={product.sku}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{product.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · {formatDate(product.caducidad)} ·{" "}
                        {product.diasCaducidad} día(s)
                      </p>
                    </div>

                    <Badge className="bg-amber-500 hover:bg-amber-500">
                      {product.descuentoSugerido}% descuento
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

       <Card className="racknova-card">
  <CardHeader>
    <div className="space-y-2">
      <CardTitle className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-red-600" />
        Restock urgente
      </CardTitle>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-semibold text-foreground">
          ¿Por qué aparece como restock urgente?
        </p>
        <p className="text-muted-foreground mt-1">
          Un producto entra en esta lista cuando su cantidad actual es menor o
          igual al stock mínimo configurado para ese producto.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Fórmula usada:{" "}
          <span className="font-semibold text-foreground">
            cantidad actual ≤ stock mínimo
          </span>
        </p>
      </div>
    </div>
  </CardHeader>

  <CardContent>
    {lowStockProducts.length === 0 ? (
      <EmptyState text="No hay productos con stock bajo." />
    ) : (
      <div className="space-y-3">
        {lowStockProducts.map((product) => {
          const faltanteSugerido = Math.max(
            product.stockMinimo - product.cantidad,
            0
          );

          return (
            <div
              key={product.sku}
              className="rounded-lg border p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{product.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.sku} · Ubicación {product.locationId}
                  </p>
                </div>

                <Badge variant="destructive">Restock urgente</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">
                    Stock actual
                  </p>
                  <p className="font-bold text-red-600">
                    {product.cantidad}
                  </p>
                </div>

                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">
                    Stock mínimo
                  </p>
                  <p className="font-bold">{product.stockMinimo}</p>
                </div>

                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">
                    Faltante mínimo
                  </p>
                  <p className="font-bold text-orange-600">
                    {faltanteSugerido}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Se recomienda resurtir porque el stock actual de{" "}
                <span className="font-semibold text-foreground">
                  {product.cantidad}
                </span>{" "}
                está por debajo o igual al mínimo configurado de{" "}
                <span className="font-semibold text-foreground">
                  {product.stockMinimo}
                </span>
                .
              </p>
            </div>
          );
        })}
      </div>
    )}
  </CardContent>
</Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-sky-600" />
              Productos sin venta
            </CardTitle>
          </CardHeader>

          <CardContent>
            {notSoldProducts.length === 0 ? (
              <EmptyState text="Todos los productos tienen ventas registradas." />
            ) : (
              <div className="space-y-3">
                {notSoldProducts.map((product) => (
                  <div
                    key={product.sku}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{product.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · Ubicación {product.locationId}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-sky-600">{product.cantidad}</p>
                      <p className="text-xs text-muted-foreground">stock</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              Margen bajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {lowMarginProducts.length === 0 ? (
              <EmptyState text="No hay productos con margen bajo en ventas registradas." />
            ) : (
              <div className="space-y-3">
                {lowMarginProducts.map((product) => (
                  <div
                    key={product.sku}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{product.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · Ganancia {money(product.ganancia)}
                      </p>
                    </div>

                    <Badge className="bg-orange-500 hover:bg-orange-500">
                      {percent(product.margen)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Chat completo con RackNova IA
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickQuestions.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => askIA(item.prompt)}
                  disabled={loading}
                  className="text-left rounded-xl border p-4 hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>

                    <p className="font-semibold">{item.title}</p>
                  </div>

                  <p className="text-xs text-muted-foreground">{item.prompt}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border bg-muted/20 p-4 h-[420px] overflow-y-auto space-y-4">
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-blue-600">
                        <Bot className="h-3.5 w-3.5" />
                        RACKNOVA IA
                      </div>
                    )}

                    {message.warning && (
                      <div className="mb-2 rounded-md bg-amber-100 text-amber-900 px-2 py-1 text-xs">
                        {message.warning}
                      </div>
                    )}

                    <p>{message.content}</p>

                    {!isUser && message.source && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Fuente:{" "}
                        {message.source === "deepseek"
                          ? "IA externa"
                          : message.source === "motor_interno_fallback"
                          ? "Motor interno RackNova"
                          : message.source}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-background border flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando inventario...
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  askIA();
                }
              }}
              placeholder="Pregúntale a RackNova IA sobre inventario, ventas, caducidad, descuentos, margen o ubicación..."
              className="min-h-[48px] max-h-32 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />

            <Button
              type="button"
              size="icon"
              onClick={() => askIA()}
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Enter para enviar, Shift + Enter para salto de línea.
            </div>

            <button
              type="button"
              onClick={clearChat}
              className="inline-flex items-center gap-1 hover:text-foreground underline"
            >
              <RefreshCcw className="h-3 w-3" />
              Limpiar chat
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
