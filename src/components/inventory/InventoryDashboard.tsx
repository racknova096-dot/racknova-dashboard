import React, { useState } from "react";
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
import { useReports } from "@/hooks/useReports";
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

  const {
    locations,
    getTotalProducts,
    getLowStockProducts,
    getProductByLocation,
  } = useInventory();

  const { toast } = useToast();
  const { downloadPDF, downloadExcel } = useReports();

  const totalSlots = locations.filter(
    (location) => location.rack === selectedRack
  ).length;

  const occupiedSlots = locations
    .filter((location) => location.rack === selectedRack)
    .filter((location) => getProductByLocation(location.id)).length;

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
  };

  const handleRestringir = () => {
    publishMQTT("Entrada/admision", "0");
    setSystemState("restringido");
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
    <PageHero
  badge="Centro de control RackNova"
  title="Inventario por Rack y Nivel"
  description="Supervisa el estado físico del rack, la ocupación por nivel, productos activos y control de admisión."
  icon={Package}
  actions={
    <>
      <Button
        onClick={handleAdmitir}
        className="bg-green-600 text-white hover:bg-green-700"
      >
        Admitir
      </Button>

      <Button
        onClick={handleRestringir}
        className="bg-red-600 text-white hover:bg-red-700"
      >
        Restringir
      </Button>

      <Button variant="destructive" onClick={handleClearRack}>
        <Trash2 className="h-4 w-4 mr-2" />
        Limpiar Rack {selectedRack}
      </Button>
    </>
  }
>
  Haz clic en un slot verde para agregar producto rápidamente o usa la página
  Agregar para capturar inventario con más detalle.
</PageHero>

      {systemState && (
        <Card
          className={`border ${
            systemState === "admitido"
              ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-900"
              : "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900"
          }`}
        >
          <CardContent className="p-4">
            <div
              className={`flex items-center gap-2 font-medium ${
                systemState === "admitido"
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              {systemState === "admitido"
                ? "Sistema en modo ADMITIDO"
                : "Sistema en modo RESTRINGIDO"}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total de Productos
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">{getTotalProducts()}</div>
            <p className="text-xs text-muted-foreground">
              productos en inventario
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Stock Bajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {getLowStockProducts().length}
            </div>
            <p className="text-xs text-muted-foreground">
              productos con stock crítico
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Slots Ocupados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {occupiedSlots}
            </div>
            <p className="text-xs text-muted-foreground">
              de {totalSlots} slots disponibles
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Rack Actual
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {selectedRack}
            </div>
            <p className="text-xs text-muted-foreground">
              {occupancyPercentage}% ocupado
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Rack {selectedRack} - Todos los Niveles</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Selecciona un rack para visualizar sus niveles y slots.
              </p>
            </div>

            <Select
              value={selectedRack}
              onValueChange={(value) => setSelectedRack(value as Rack)}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Seleccionar Rack" />
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

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Nivel 1</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getNivelStats(1).free} libres / {getNivelStats(1).occupied}{" "}
                  ocupados
                </p>
              </CardHeader>

              <CardContent>
                <SlotGrid
                  rack={selectedRack}
                  nivel={1}
                  onSlotClick={handleSlotClick}
                />
              </CardContent>
            </Card>

            <Card className="border bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Nivel 2</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getNivelStats(2).free} libres / {getNivelStats(2).occupied}{" "}
                  ocupados
                </p>
              </CardHeader>

              <CardContent>
                <SlotGrid
                  rack={selectedRack}
                  nivel={2}
                  onSlotClick={handleSlotClick}
                />
              </CardContent>
            </Card>

            <Card className="border bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Nivel 3</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getNivelStats(3).free} libres / {getNivelStats(3).occupied}{" "}
                  ocupados
                </p>
              </CardHeader>

              <CardContent>
                <SlotGrid
                  rack={selectedRack}
                  nivel={3}
                  onSlotClick={handleSlotClick}
                />
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="font-semibold mb-3">Leyenda de estados</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-green-500" />
                Slot libre
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-yellow-400" />
                En proceso de colocación
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-red-500" />
                Slot ocupado
              </div>

              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-purple-500" />
                Quitando producto
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <RealTimeCharts />

      <Card className="racknova-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Reportes
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Descargar reporte completo del inventario, productos,
                ubicaciones, stock bajo y estadísticas generales.
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Reporte
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadPDF}>
                  Descargar PDF
                </DropdownMenuItem>

                <DropdownMenuItem onClick={downloadExcel}>
                  Descargar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Los reportes toman la información actual del inventario y ayudan a
              revisar ocupación, productos existentes y alertas de bajo stock.
            </p>
          </div>
        </CardContent>
      </Card>

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
