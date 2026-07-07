import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInventory } from "@/context/InventoryContext";
import { useToast } from "@/hooks/use-toast";
import { QRConfirmationModal } from "./QRConfirmationModal";
import { Package, Plus, MapPin } from "lucide-react";

export function InventoryForm() {
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [costoProveedor, setCostoProveedor] = useState("");
  const [precioVentaSugerido, setPrecioVentaSugerido] = useState("");
  const [caducidad, setCaducidad] = useState("");
  const [caducidadNoAplica, setCaducidadNoAplica] = useState(true);
  const [stockMinimo, setStockMinimo] = useState("");
  const [selectedRack, setSelectedRack] = useState("");
  const [selectedNivel, setSelectedNivel] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [showQRConfirmation, setShowQRConfirmation] = useState(false);

  const [lastAddedProduct, setLastAddedProduct] = useState<{
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;
  } | null>(null);

  const { locations, addProduct, getProductByLocation } = useInventory();
  const { toast } = useToast();

  const availableSlots = locations.filter((loc) => {
    if (!selectedRack || !selectedNivel) return false;

    const isCorrectLocation =
      loc.rack === selectedRack && loc.nivel.toString() === selectedNivel;

    const hasProduct = getProductByLocation(loc.id);

    return isCorrectLocation && !hasProduct;
  });

  const resetForm = () => {
    setSku("");
    setNombre("");
    setCantidad("");
    setDescripcion("");
    setCostoProveedor("");
    setPrecioVentaSugerido("");
    setCaducidad("");
    setCaducidadNoAplica(true);
    setStockMinimo("");
    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRack || !selectedNivel || !selectedSlot) {
      toast({
        title: "Error",
        description: "Debe seleccionar rack, nivel y slot",
        variant: "destructive",
      });

      return;
    }

    const cantidadNum = parseInt(cantidad);

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser un número positivo",
        variant: "destructive",
      });

      return;
    }

    const costoProveedorNum = parseFloat(costoProveedor);

    if (isNaN(costoProveedorNum) || costoProveedorNum < 0) {
      toast({
        title: "Error",
        description: "El costo proveedor debe ser un número válido",
        variant: "destructive",
      });

      return;
    }

    const precioVentaSugeridoNum = parseFloat(precioVentaSugerido);

    if (isNaN(precioVentaSugeridoNum) || precioVentaSugeridoNum < 0) {
      toast({
        title: "Error",
        description: "El precio de venta sugerido debe ser un número válido",
        variant: "destructive",
      });

      return;
    }

    const stockMinimoNum =
      stockMinimo.trim() === "" ? 10 : parseInt(stockMinimo);

    if (isNaN(stockMinimoNum) || stockMinimoNum <= 0) {
      toast({
        title: "Error",
        description: "El stock crítico debe ser un número mayor a 0.",
        variant: "destructive",
      });

      return;
    }

    const caducidadValue = caducidadNoAplica || !caducidad ? null : caducidad;

    const locationId = `${selectedRack}-${selectedNivel}-${selectedSlot}`;

    addProduct({
      locationId,
      sku,
      nombre,
      cantidad: cantidadNum,
      costo_proveedor: costoProveedorNum,
      precio_venta_sugerido: precioVentaSugeridoNum,
      caducidad: caducidadValue,
      stock_minimo: stockMinimoNum,
    });

    setLastAddedProduct({
      sku,
      nombre,
      rack: selectedRack,
      nivel: parseInt(selectedNivel),
      slot: parseInt(selectedSlot),
      timestamp: new Date(),
    });

    setShowQRConfirmation(true);

    resetForm();
  };

  return (
    <div className="space-y-6">
      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Agregar Nuevo Producto
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Información del Producto
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>

                    <Input
                      id="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Ej: SKU001"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre del Producto *</Label>

                    <Input
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Tomates Cherry"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>

                    <Input
                      id="cantidad"
                      type="number"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      placeholder="Ej: 100"
                      min="1"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción (Opcional)</Label>

                    <Textarea
                      id="descripcion"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Descripción adicional del producto..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costoProveedor">
                      Costo proveedor unitario *
                    </Label>

                    <Input
                      id="costoProveedor"
                      type="number"
                      value={costoProveedor}
                      onChange={(e) => setCostoProveedor(e.target.value)}
                      placeholder="Ej: 60.00"
                      min="0"
                      step="0.01"
                      required
                    />

                    <p className="text-xs text-muted-foreground">
                      Costo real de compra por unidad.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precioVentaSugerido">
                      Precio de venta sugerido *
                    </Label>

                    <Input
                      id="precioVentaSugerido"
                      type="number"
                      value={precioVentaSugerido}
                      onChange={(e) => setPrecioVentaSugerido(e.target.value)}
                      placeholder="Ej: 120.00"
                      min="0"
                      step="0.01"
                      required
                    />

                    <p className="text-xs text-muted-foreground">
                      Este precio se cargará automáticamente al registrar una
                      salida, pero podrá modificarse manualmente.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caducidad">Caducidad</Label>

                    <div className="flex items-center gap-2">
                      <input
                        id="caducidadNoAplica"
                        type="checkbox"
                        checked={caducidadNoAplica}
                        onChange={(e) => {
                          setCaducidadNoAplica(e.target.checked);

                          if (e.target.checked) {
                            setCaducidad("");
                          }
                        }}
                      />

                      <Label
                        htmlFor="caducidadNoAplica"
                        className="text-sm font-normal"
                      >
                        No aplica
                      </Label>
                    </div>

                    <Input
                      id="caducidad"
                      type="date"
                      value={caducidad}
                      onChange={(e) => setCaducidad(e.target.value)}
                      disabled={caducidadNoAplica}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stockMinimo">
                      Stock crítico personalizado
                    </Label>

                    <Input
                      id="stockMinimo"
                      type="number"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)}
                      placeholder="Opcional. Por defecto: 10"
                      min="1"
                    />

                    <p className="text-xs text-muted-foreground">
                      Si lo dejas vacío, el sistema usará 10. El producto será
                      crítico cuando la cantidad sea menor a este valor.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Ubicación en Inventario
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rack">Rack *</Label>

                    <Select
                      value={selectedRack}
                      onValueChange={(value) => {
                        setSelectedRack(value);
                        setSelectedNivel("");
                        setSelectedSlot("");
                      }}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="nivel">Nivel *</Label>

                    <Select
                      value={selectedNivel}
                      onValueChange={(value) => {
                        setSelectedNivel(value);
                        setSelectedSlot("");
                      }}
                      disabled={!selectedRack}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar Nivel" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="1">Nivel 1</SelectItem>
                        <SelectItem value="2">Nivel 2</SelectItem>
                        <SelectItem value="3">Nivel 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slot">Slot *</Label>

                    <Select
                      value={selectedSlot}
                      onValueChange={setSelectedSlot}
                      disabled={!selectedNivel || availableSlots.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar Slot" />
                      </SelectTrigger>

                      <SelectContent>
                        {availableSlots.length === 0 ? (
                          <SelectItem value="none" disabled>
                            {!selectedNivel
                              ? "Seleccione nivel primero"
                              : "No hay slots disponibles"}
                          </SelectItem>
                        ) : (
                          availableSlots.map((location) => (
                            <SelectItem
                              key={location.id}
                              value={location.slot.toString()}
                            >
                              Slot {location.slot}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRack && selectedNivel && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">
                        <strong>Ubicación seleccionada:</strong>
                      </p>

                      <p className="font-mono text-sm">
                        {selectedRack}-{selectedNivel}-{selectedSlot || "?"}
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        {availableSlots.length} slots disponibles en este nivel
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpiar Formulario
              </Button>

              <Button type="submit">Agregar Producto</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <QRConfirmationModal
        isOpen={showQRConfirmation}
        onClose={() => setShowQRConfirmation(false)}
        productData={lastAddedProduct}
      />
    </div>
  );
}
