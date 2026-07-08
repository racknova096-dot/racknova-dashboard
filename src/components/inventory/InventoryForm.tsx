import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config";
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
import {
  Package,
  Plus,
  MapPin,
  Search,
  Lock,
  RotateCcw,
  History,
} from "lucide-react";
import { ProductoCatalogo } from "@/types/inventory";

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
  const [stockAlto, setStockAlto] = useState("");

  const [selectedRack, setSelectedRack] = useState("");
  const [selectedNivel, setSelectedNivel] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [catalogResults, setCatalogResults] = useState<ProductoCatalogo[]>([]);
  const [selectedCatalogProduct, setSelectedCatalogProduct] =
    useState<ProductoCatalogo | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [showQRConfirmation, setShowQRConfirmation] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<{
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;
  } | null>(null);

  const { products, locations, addProduct, getProductByLocation } =
    useInventory();
  const { toast } = useToast();

  const existingInventoryProduct = useMemo(() => {
    const skuClean = sku.trim().toLowerCase();

    if (!skuClean) return undefined;

    return products.find((product) => product.sku.trim().toLowerCase() === skuClean);
  }, [products, sku]);

  const isHistoricalProduct = Boolean(selectedCatalogProduct);
  const isRestock = Boolean(existingInventoryProduct);

  const availableSlots = locations.filter((loc) => {
    if (!selectedRack || !selectedNivel) return false;

    const isCorrectLocation =
      loc.rack === selectedRack && loc.nivel.toString() === selectedNivel;

    const hasProduct = getProductByLocation(loc.id);

    return isCorrectLocation && !hasProduct;
  });

  const searchTerm = useMemo(() => {
    if (selectedCatalogProduct) return "";

    const skuClean = sku.trim();
    const nombreClean = nombre.trim();

    return skuClean || nombreClean;
  }, [sku, nombre, selectedCatalogProduct]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setCatalogResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setCatalogLoading(true);

        const response = await fetch(
          `${API_URL}/catalogo/productos/buscar?query=${encodeURIComponent(
            searchTerm
          )}`
        );

        if (!response.ok) {
          setCatalogResults([]);
          return;
        }

        const data = await response.json();

        const results: ProductoCatalogo[] = Array.isArray(data)
          ? data
          : data?.productos ?? data?.resultados ?? [];

        setCatalogResults(results);

        const exactMatch = results.find((item) => {
          const itemSku = item.sku?.trim().toLowerCase();
          const itemNombre = item.nombre?.trim().toLowerCase();
          const term = searchTerm.trim().toLowerCase();

          return itemSku === term || itemNombre === term;
        });

        if (exactMatch) {
          handleSelectCatalogProduct(exactMatch);
        }
      } catch (error) {
        console.error("Error buscando catálogo histórico:", error);
        setCatalogResults([]);
      } finally {
        setCatalogLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

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
    setStockAlto("");

    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");

    setCatalogResults([]);
    setSelectedCatalogProduct(null);
  };

  const clearHistoricalSelection = () => {
    setSelectedCatalogProduct(null);
    setCatalogResults([]);
    setSku("");
    setNombre("");
    setDescripcion("");
    setCostoProveedor("");
    setPrecioVentaSugerido("");
    setCaducidad("");
    setCaducidadNoAplica(true);
    setStockMinimo("");
    setStockAlto("");
    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");
  };

  const handleSelectCatalogProduct = (item: ProductoCatalogo) => {
    setSelectedCatalogProduct(item);

    setSku(item.sku ?? "");
    setNombre(item.nombre ?? "");
    setDescripcion(item.descripcion ?? "");

    const costoSugerido =
      item.ultimo_costo_proveedor ??
      item.costo_promedio ??
      0;

    setCostoProveedor(Number(costoSugerido).toString());
    setPrecioVentaSugerido(Number(item.precio_venta_sugerido ?? 0).toString());

    if (item.caducidad) {
      setCaducidad(item.caducidad);
      setCaducidadNoAplica(false);
    } else {
      setCaducidad("");
      setCaducidadNoAplica(true);
    }

    setStockMinimo(Number(item.stock_minimo ?? 10).toString());
    setStockAlto(Number(item.stock_alto ?? 30).toString());

    const currentProduct = products.find(
      (product) =>
        product.sku.trim().toLowerCase() === item.sku.trim().toLowerCase()
    );

    if (currentProduct) {
      const [rack, nivel, slot] = currentProduct.locationId.split("-");

      setSelectedRack(rack);
      setSelectedNivel(nivel);
      setSelectedSlot(slot);
    } else {
      setSelectedRack("");
      setSelectedNivel("");
      setSelectedSlot("");
    }

    setCatalogResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const skuClean = sku.trim();
    const nombreClean = nombre.trim();

    if (!skuClean || !nombreClean) {
      toast({
        title: "Error",
        description: "El SKU y el nombre son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const cantidadNum = parseInt(cantidad);

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser un número positivo.",
        variant: "destructive",
      });
      return;
    }

    const costoProveedorNum = parseFloat(costoProveedor);

    if (isNaN(costoProveedorNum) || costoProveedorNum < 0) {
      toast({
        title: "Error",
        description: "El costo proveedor debe ser un número válido.",
        variant: "destructive",
      });
      return;
    }

    const precioVentaSugeridoNum = parseFloat(precioVentaSugerido);

    if (isNaN(precioVentaSugeridoNum) || precioVentaSugeridoNum < 0) {
      toast({
        title: "Error",
        description: "El precio de venta sugerido debe ser un número válido.",
        variant: "destructive",
      });
      return;
    }

    const stockMinimoNum =
      stockMinimo.trim() === "" ? 10 : parseInt(stockMinimo);

    if (isNaN(stockMinimoNum) || stockMinimoNum <= 0) {
      toast({
        title: "Error",
        description: "El stock bajo debe ser un número mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    const stockAltoNum =
      stockAlto.trim() === "" ? stockMinimoNum * 3 : parseInt(stockAlto);

    if (isNaN(stockAltoNum) || stockAltoNum <= stockMinimoNum) {
      toast({
        title: "Error",
        description:
          "El stock alto debe ser mayor que el stock bajo/mínimo.",
        variant: "destructive",
      });
      return;
    }

    let locationId = "";

    if (existingInventoryProduct) {
      locationId = existingInventoryProduct.locationId;
    } else {
      if (!selectedRack || !selectedNivel || !selectedSlot) {
        toast({
          title: "Error",
          description: "Debe seleccionar rack, nivel y slot.",
          variant: "destructive",
        });
        return;
      }

      locationId = `${selectedRack}-${selectedNivel}-${selectedSlot}`;
    }

    const [finalRack, finalNivel, finalSlot] = locationId.split("-");

    const caducidadValue =
      caducidadNoAplica || !caducidad ? null : caducidad;

    try {
      await addProduct({
        locationId,
        sku: skuClean,
        nombre: nombreClean,
        cantidad: cantidadNum,
        costo_proveedor: costoProveedorNum,
        precio_venta_sugerido: precioVentaSugeridoNum,
        caducidad: caducidadValue,
        stock_minimo: stockMinimoNum,
        stock_alto: stockAltoNum,
      });

      setLastAddedProduct({
        sku: skuClean,
        nombre: nombreClean,
        rack: finalRack,
        nivel: parseInt(finalNivel),
        slot: parseInt(finalSlot),
        timestamp: new Date(),
      });

      setShowQRConfirmation(true);

      toast({
        title: isRestock ? "Restock registrado" : "Producto agregado",
        description: isRestock
          ? `Se sumaron ${cantidadNum} pieza(s) a ${nombreClean}.`
          : `${nombreClean} fue agregado al inventario.`,
      });

      resetForm();
    } catch (error) {
      console.error("Error agregando producto:", error);

      toast({
        title: "Error",
        description: "No se pudo agregar el producto.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Agregar Nuevo Producto
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Información del Producto
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <History className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">
                        Catálogo histórico
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Escribe un SKU o nombre. Si el producto ya existe en el
                        histórico, RackNova rellenará la información
                        automáticamente.
                      </p>
                    </div>
                  </div>

                  {catalogLoading && (
                    <p className="text-xs text-muted-foreground">
                      Buscando coincidencias...
                    </p>
                  )}

                  {!selectedCatalogProduct && catalogResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Coincidencias encontradas:
                      </p>

                      <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                        {catalogResults.map((item) => (
                          <button
                            key={`${item.sku}-${item.id_catalogo ?? item.nombre}`}
                            type="button"
                            onClick={() => handleSelectCatalogProduct(item)}
                            className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">
                                  {item.nombre}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  SKU: {item.sku}
                                </p>
                              </div>

                              <div className="text-right text-xs text-muted-foreground">
                                <p>
                                  Costo prom.: $
                                  {Number(item.costo_promedio ?? 0).toFixed(2)}
                                </p>
                                <p>
                                  Venta sug.: $
                                  {Number(
                                    item.precio_venta_sugerido ?? 0
                                  ).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCatalogProduct && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Producto cargado desde histórico
                          </p>
                          <p className="text-xs mt-1">
                            SKU y nombre quedan bloqueados para evitar
                            duplicados. Puedes modificar costos, precios, stock,
                            caducidad y cantidad.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearHistoricalSelection}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  )}

                  {isRestock && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-semibold">Restock detectado</p>
                      <p className="text-xs mt-1">
                        Este producto ya existe en inventario. RackNova sumará
                        la nueva cantidad, conservará la ubicación{" "}
                        <strong>{existingInventoryProduct?.locationId}</strong>{" "}
                        y recalculará el costo promedio.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="sku"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Ej: SKU001"
                        className="pl-9"
                        required
                        disabled={isHistoricalProduct}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre del Producto *</Label>
                    <Input
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Tomates Cherry"
                      required
                      disabled={isHistoricalProduct}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cantidad">
                      {isRestock ? "Cantidad a ingresar *" : "Cantidad *"}
                    </Label>
                    <Input
                      id="cantidad"
                      type="number"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      placeholder="Ej: 100"
                      min="1"
                      required
                    />
                    {isRestock && (
                      <p className="text-xs text-muted-foreground">
                        Stock actual: {existingInventoryProduct?.cantidad} pieza(s).
                        Se sumará la cantidad nueva.
                      </p>
                    )}
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
                      Si es restock, este costo se usará para recalcular el costo
                      promedio.
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
                    <Label htmlFor="stockMinimo">Stock bajo / mínimo</Label>
                    <Input
                      id="stockMinimo"
                      type="number"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)}
                      placeholder="Por defecto: 10"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Si lo dejas vacío, el sistema usará 10.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stockAlto">Stock alto</Label>
                    <Input
                      id="stockAlto"
                      type="number"
                      value={stockAlto}
                      onChange={(e) => setStockAlto(e.target.value)}
                      placeholder="Por defecto: stock bajo x 3"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Debe ser mayor que el stock bajo. Sirve para detectar
                      sobreinventario.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="descripcion">Descripción opcional</Label>
                    <Textarea
                      id="descripcion"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Descripción adicional del producto..."
                      rows={3}
                    />
                  </div>
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
                {isRestock ? (
                  <div className="rounded-md border bg-muted/40 p-4">
                    <p className="text-sm font-semibold">
                      Ubicación fija por restock
                    </p>
                    <p className="font-mono text-sm mt-1">
                      {existingInventoryProduct?.locationId}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Como el producto ya está en inventario, RackNova usará la
                      misma ubicación y no permitirá seleccionar otra.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpiar Formulario
              </Button>

              <Button type="submit">
                {isRestock ? "Registrar Restock" : "Agregar Producto"}
              </Button>
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
