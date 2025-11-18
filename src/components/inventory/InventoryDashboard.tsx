import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    clearRack,
    startProductPlacement,
  } = useInventory();
  const { toast } = useToast();
  const { downloadPDF, downloadExcel } = useReports();

  const totalSlots = locations.filter(
    (loc) => loc.rack === selectedRack
  ).length;
  const occupiedSlots = locations
    .filter((loc) => loc.rack === selectedRack)
    .filter((loc) => getProductByLocation(loc.id)).length;

  // Contadores por nivel
  const getNivelStats = (nivel: Nivel) => {
    const nivelLocations = locations.filter(
      (loc) => loc.rack === selectedRack && loc.nivel === nivel
    );
    const occupiedInNivel = nivelLocations.filter((loc) =>
      getProductByLocation(loc.id)
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
      // Don't start placement process here - only when product is actually added
      setSelectedProduct(null);
      setModalMode("add");
    }
    setModalOpen(true);
  };

  const handleClearRack = () => {
    clearRack(selectedRack);
    toast({
      title: "Rack limpiado",
      description: `Todos los productos del rack ${selectedRack} han sido eliminados`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Inventario por Rack y Nivel
          </h1>

          {/* MENSAJE DINÁMICO DEL SISTEMA */}
          {systemState && (
            <div
              className={`text-sm font-semibold px-3 py-2 rounded-md ${
                systemState === "admitido"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {systemState === "admitido"
                ? "🟢 Sistema en modo ADMITIDO"
                : "🔴 Sistema en modo RESTRINGIDO"}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {/* ADMITIR */}
          <button
            onClick={() => {
              publishMQTT("Entrada/admision", "8113");
              setSystemState("admitido");
            }}
            className="h-10 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium flex items-center gap-2"
          >
            Admitir
          </button>

          {/* RESTRINGIR */}
          <button
            onClick={() => {
              publishMQTT("Entrada/admision", "0");
              setSystemState("restringido");
            }}
            className="h-10 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 font-medium flex items-center gap-2"
          >
            Restringir
          </button>

          {/* LIMPIAR RACK */}
          <Button
            variant="outline"
            onClick={handleClearRack}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar Rack {selectedRack}
          </Button>
        </div>
      </div>

      {/* Quick Add Info */}
      <div className="bg-accent/50 p-4 rounded-lg border border-accent">
        <p className="text-sm text-foreground">
          💡 <strong>Consejo:</strong> Haz click en un slot verde (libre) para
          agregar productos rápidamente, o usa el{" "}
          <strong>botón "Agregar" en la navegación</strong> para el formulario
          completo de inventario.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Productos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalProducts()}</div>
            <p className="text-xs text-muted-foreground">
              productos en inventario
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getLowStockProducts().length}
            </div>
            <p className="text-xs text-muted-foreground">
              productos con stock ≤ 10
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Slots Ocupados
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupiedSlots}</div>
            <p className="text-xs text-muted-foreground">
              de {totalSlots} slots disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rack Actual</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedRack}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((occupiedSlots / totalSlots) * 100)}% ocupado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rack Selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Rack {selectedRack} - Todos los Niveles</CardTitle>
            <div className="space-y-2">
              <label className="text-sm font-medium">Seleccionar Rack</label>
              <Select
                value={selectedRack}
                onValueChange={(value) => setSelectedRack(value as Rack)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Nivel 1 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nivel 1</h3>
              <div className="text-sm text-muted-foreground">
                {getNivelStats(1).free} Libres / {getNivelStats(1).occupied}{" "}
                Ocupados
              </div>
            </div>
            <SlotGrid
              rack={selectedRack}
              nivel={1}
              onSlotClick={handleSlotClick}
            />
          </div>

          {/* Nivel 2 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nivel 2</h3>
              <div className="text-sm text-muted-foreground">
                {getNivelStats(2).free} Libres / {getNivelStats(2).occupied}{" "}
                Ocupados
              </div>
            </div>
            <SlotGrid
              rack={selectedRack}
              nivel={2}
              onSlotClick={handleSlotClick}
            />
          </div>

          {/* Nivel 3 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nivel 3</h3>
              <div className="text-sm text-muted-foreground">
                {getNivelStats(3).free} Libres / {getNivelStats(3).occupied}{" "}
                Ocupados
              </div>
            </div>
            <SlotGrid
              rack={selectedRack}
              nivel={3}
              onSlotClick={handleSlotClick}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 rounded border border-green-300"></div>
              <span className="text-sm">Slot Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded border border-yellow-300 animate-pulse"></div>
              <span className="text-sm">En Proceso de Colocación</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-br from-red-100 to-red-200 rounded border border-red-300"></div>
              <span className="text-sm">Slot Ocupado</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real Time Charts Section */}
      <RealTimeCharts />

      {/* Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Descargar reporte completo del inventario
              </p>
              <p className="text-xs text-muted-foreground">
                Incluye productos, ubicaciones, stock bajo y estadísticas
                generales
              </p>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Descargar Reporte
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={downloadPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadExcel}>
                    <Package className="h-4 w-4 mr-2" />
                    Descargar Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Modal */}
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
