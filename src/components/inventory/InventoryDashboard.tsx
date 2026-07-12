import React, { useState } from "react";
import { canModifyInventory, isAdmin } from "@/lib/roles";
import { API_URL } from "@/config";

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

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useInventory } from "@/context/InventoryContext";
import { useReports, ReportPeriod } from "@/hooks/useReports";

import { SlotGrid } from "./SlotGrid";
import { ProductModal } from "./ProductModal";
import { RealTimeCharts } from "./RealTimeCharts";
import { PageHero } from "@/components/layout/PageHero";

import { Location, Product, Rack, Nivel } from "@/types/inventory";

import {
  Package,
  AlertTriangle,
  TrendingUp,
  Trash2,
  Download,
  FileText,
  ChevronDown,
  ShieldCheck,
  ShieldOff,
  Layers3,
  Boxes,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { publishMQTT } from "@/mqtt/mqttClient";

export function InventoryDashboard() {
  const [selectedRack, setSelectedRack] = useState<Rack>("A");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [systemState, setSystemState] = useState<
    "admitido" | "restringido" | null
  >(null);

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("all");

  const {
    locations,
    getTotalProducts,
    getLowStockProducts,
    getProductByLocation,
  } = useInventory();

  const { toast } = useToast();
  const { downloadPDF, downloadExcel } = useReports();

  const canModify = canModifyInventory();
  const canSeeMasterReport = isAdmin();

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

  const handleSlotClick = (location: Location, hasProduct: boolean) => {
    if (!canModify && !hasProduct) {
      toast({
        title: "Solo lectura",
        description: "Tu usuario no puede agregar productos.",
        variant: "destructive",
      });

      return;
    }

    setSelectedLocation(location);

    if (hasProduct) {
      const product = getProductByLocation(location.id);
      setSelectedProduct(product || null);
      setModalMode("edit");
    } else {
      setSelectedProduct(null);
      setModalMode("add");
    }

    setModalOpen(true);
  };

  const handleClearRack = async () => {
    if (!canModify) {
      toast({
        title: "Solo lectura",
        description: "Tu usuario no puede limpiar racks.",
        variant: "destructive",
      });

      return;
    }

    const confirmar = window.confirm(
      "⚠️ Esto borrará TODOS los productos y TODOS los movimientos de la base de datos.\n\n¿Seguro que quieres continuar?"
    );

    if (!confirmar) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/clear-all?confirm=BORRAR_TODO_RACKNOVA`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      toast({
        title: "Base de datos limpiada",
        description: "Se eliminaron todos los productos y movimientos.",
      });

      window.location.reload();
    } catch (error) {
      console.error("❌ Error limpiando base de datos:", error);

      toast({
        title: "Error",
        description: "No se pudo limpiar la base de datos.",
        variant: "destructive",
      });
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

  const masterReportControls = canSeeMasterReport ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-full sm:w-52">
        <Select
          value={reportPeriod}
          onValueChange={(value) => setReportPeriod(value as ReportPeriod)}
        >
          <SelectTrigger className="bg-white/90 dark:bg-slate-950/80">
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
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Reporte maestro
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => downloadPDF(reportPeriod)}>
            <FileText className="h-4 w-4 mr-2" />
            Descargar PDF
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => downloadExcel(reportPeriod)}>
            <Download className="h-4 w-4 mr-2" />
            Descargar Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <PageHero
        badge="Centro operativo RackNova"
        title="Dashboard"
        description={
          canSeeMasterReport
            ? `Control del rack, monitoreo del inventario y reporte maestro completo. Periodo actual del reporte: ${getReportPeriodLabel(
                reportPeriod
              )}.`
            : "Control del rack y monitoreo del inventario."
        }
        icon={Package}
        actions={
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {masterReportControls}

            {canModify && (
              <>
                <Button
                  onClick={handleAdmitir}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Admitir
                </Button>

                <Button
                  onClick={handleRestringir}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Restringir
                </Button>

                <Button variant="destructive" onClick={handleClearRack}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Rack {selectedRack}
                </Button>
              </>
            )}
          </div>
        }
      >
        {canSeeMasterReport ? (
          <>
            El reporte maestro incluye inventario completo, finanzas, ventas,
            movimientos, recuperación de inversión, productos sin venta, stock,
            caducidades, alertas y gráficas.
          </>
        ) : (
          <>
            Haz clic en un slot verde para agregar producto rápidamente o usa la
            página Agregar para capturar inventario con más detalle.
          </>
        )}
      </PageHero>

      {systemState && (
        <Card className="racknova-card">
          <CardContent className="pt-6">
            <div
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                systemState === "admitido"
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900 dark:text-green-200"
                  : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200"
              }`}
            >
              {systemState === "admitido" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldOff className="h-5 w-5" />
              )}

              <p className="font-medium">
                {systemState === "admitido"
                  ? "Sistema en modo ADMITIDO"
                  : "Sistema en modo RESTRINGIDO"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Total de Productos
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{getTotalProducts()}</div>
            <p className="text-sm text-muted-foreground">
              productos en inventario
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Stock Bajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {getLowStockProducts().length}
            </div>
            <p className="text-sm text-muted-foreground">
              productos con stock crítico
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              Slots Ocupados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{occupiedSlots}</div>
            <p className="text-sm text-muted-foreground">
              de {totalSlots} slots disponibles
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rack Actual
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{selectedRack}</div>
            <p className="text-sm text-muted-foreground">
              {occupancyPercentage}% ocupado · {freeSlots} libres
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Rack {selectedRack} - Todos los Niveles
            </CardTitle>

            <p className="text-sm text-muted-foreground mt-1">
              Selecciona un rack para visualizar sus niveles y slots.
            </p>
          </div>

          <div className="w-full lg:w-48">
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
        </CardHeader>

        <CardContent className="space-y-8">
          {[1, 2, 3].map((nivel) => {
            const stats = getNivelStats(nivel as Nivel);

            return (
              <div key={nivel} className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold">Nivel {nivel}</h3>

                  <p className="text-sm text-muted-foreground">
                    {stats.free} libres / {stats.occupied} ocupados
                  </p>
                </div>

                <SlotGrid
                  rack={selectedRack}
                  nivel={nivel as Nivel}
                  onSlotClick={handleSlotClick}
                />
              </div>
            );
          })}

          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="font-semibold mb-3">Leyenda de estados</h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-green-500" />
                <span className="text-sm">Slot libre</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-yellow-400" />
                <span className="text-sm">En proceso de colocación</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-red-500" />
                <span className="text-sm">Slot ocupado</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-purple-500" />
                <span className="text-sm">Quitando producto</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <RealTimeCharts />

      <ProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        location={selectedLocation}
        product={selectedProduct}
        mode={modalMode}
      />
    </div>
  );
}
