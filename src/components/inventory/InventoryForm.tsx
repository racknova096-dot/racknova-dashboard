import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInventory } from "@/context/InventoryContext";
import { Rack, Nivel } from "@/types/inventory";
import { useToast } from "@/hooks/use-toast";
import { QRConfirmationModal } from "./QRConfirmationModal";
import { Package, Plus, MapPin } from "lucide-react";
import { publishMQTT } from "@/mqtt/mqttClient"; // 👈 Añadir esto

export function InventoryForm() {
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [selectedRack, setSelectedRack] = useState<string>("");
  const [selectedNivel, setSelectedNivel] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [showQRConfirmation, setShowQRConfirmation] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<{
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;
  } | null>(null);

  const { locations, addProduct, getProductByLocation, startProductPlacement } =
    useInventory();
  const { toast } = useToast();

  // Get available slots for selected rack and nivel
  const availableSlots = locations.filter((loc) => {
    if (!selectedRack || !selectedNivel) return false;
    const isCorrectLocation =
      loc.rack === selectedRack && loc.nivel.toString() === selectedNivel;
    const hasProduct = getProductByLocation(loc.id);
    return isCorrectLocation && !hasProduct;
  });

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

    const locationId = `${selectedRack}-${selectedNivel}-${selectedSlot}`;
    // 🟡 1️⃣ Marcar el slot como "en proceso" (amarillo)
    startProductPlacement(locationId);

    // 🧠 2️⃣ Enviar el mensaje MQTT al ESP32
    try {
      const nivelTopic = `L${selectedNivel}`; // ejemplo: L1, L2, L3
      const pin = parseInt(selectedSlot); // ejemplo: 14, 27, 32...
      publishMQTT(`Entrada/${nivelTopic}`, `p${pin}c`);
      console.log(`📡 Enviado MQTT: Entrada/${nivelTopic} → p${pin}c`);
    } catch (err) {
      console.error("❌ Error al enviar MQTT:", err);
    }

    addProduct({
      locationId,
      sku,
      nombre,
      cantidad: cantidadNum,
    });

    // Prepare data for QR generation
    setLastAddedProduct({
      sku,
      nombre,
      rack: selectedRack,
      nivel: parseInt(selectedNivel),
      slot: parseInt(selectedSlot),
      timestamp: new Date(),
    });

    // Show QR confirmation modal
    setShowQRConfirmation(true);

    // Reset form
    setSku("");
    setNombre("");
    setCantidad("");
    setDescripcion("");
    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar Nuevo Producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-4 w-4" />
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
                </CardContent>
              </Card>

              {/* Location Selection */}
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

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSku("");
                  setNombre("");
                  setCantidad("");
                  setDescripcion("");
                  setSelectedRack("");
                  setSelectedNivel("");
                  setSelectedSlot("");
                }}
              >
                Limpiar Formulario
              </Button>
              <Button type="submit">Agregar Producto</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* QR Confirmation Modal */}
      <QRConfirmationModal
        isOpen={showQRConfirmation}
        onClose={() => setShowQRConfirmation(false)}
        productData={lastAddedProduct}
      />
    </div>
  );
}
