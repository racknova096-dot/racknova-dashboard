import React, { useEffect, useMemo, useState } from "react";
import { DateInputMX } from "@/components/ui/date-input-mx";
import { BlockingLoader } from "@/components/ui/blocking-loader";
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
  AlertTriangle,
  Layers,
  X,
  Loader2,
} from "lucide-react";

import {
  ProductoCatalogo,
  ProductoLote,
  Product,
} from "@/types/inventory";

import { formatDateDDMMYYYY } from "@/lib/dateFormat";

type SelectedSource = "inventory" | "catalog" | null;

interface FefoNotice {
  nombre: string;
  locationId: string;
  caducidad: string | null;
  expiresBeforeCurrent: boolean;
}

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
  const [selectedInventoryProduct, setSelectedInventoryProduct] =
    useState<Product | null>(null);
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [activeLots, setActiveLots] = useState<ProductoLote[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [fefoNotice, setFefoNotice] = useState<FefoNotice | null>(null);

  const [showQRConfirmation, setShowQRConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [lastAddedProduct, setLastAddedProduct] = useState<{
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;
    descripcion?: string | null;
    cantidad?: number;
    costoProveedor?: number;
    precioVentaSugerido?: number;
    caducidad?: string | null;
  } | null>(null);

  const { products, locations, addProduct, getProductByLocation } =
    useInventory();

  const { toast } = useToast();

  const identityLocked =
    selectedSource === "inventory" || selectedSource === "catalog";

  const locationLocked = selectedSource === "inventory";
  const isRestock = selectedSource === "inventory";

  const availableSlots = locations.filter((loc) => {
    if (!selectedRack || !selectedNivel) return false;

    const isCorrectLocation =
      loc.rack === selectedRack && loc.nivel.toString() === selectedNivel;

    const hasProduct = getProductByLocation(loc.id);

    return isCorrectLocation && !hasProduct;
  });

  const searchTerm = useMemo(() => {
    if (selectedSource) return "";

    const skuClean = sku.trim();
    const nombreClean = nombre.trim();

    return skuClean || nombreClean;
  }, [sku, nombre, selectedSource]);

  const earliestLot = useMemo(() => {
    const lotsWithDate = activeLots
      .filter((lot) => lot.caducidad && lot.cantidad_actual > 0)
      .sort(
        (a, b) =>
          new Date(`${a.caducidad}T00:00:00`).getTime() -
          new Date(`${b.caducidad}T00:00:00`).getTime()
      );

    return lotsWithDate[0] ?? null;
  }, [activeLots]);

  const newLotExpiresBeforeCurrent = useMemo(() => {
    if (!caducidad || !earliestLot?.caducidad) return false;

    const nueva = new Date(`${caducidad}T00:00:00`).getTime();
    const actual = new Date(`${earliestLot.caducidad}T00:00:00`).getTime();

    return nueva < actual;
  }, [caducidad, earliestLot]);

  const findInventoryExactMatch = (term: string) => {
    const cleanTerm = term.trim().toLowerCase();

    if (!cleanTerm) return undefined;

    return products.find((product) => {
      const productSku = product.sku.trim().toLowerCase();
      const productName = product.nombre.trim().toLowerCase();

      return productSku === cleanTerm || productName === cleanTerm;
    });
  };

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
    setSelectedInventoryProduct(null);
    setSelectedSource(null);
    setActiveLots([]);
  };

  const clearHistoricalSelection = () => {
    resetForm();
  };

  const handleSelectInventoryProduct = (product: Product) => {
    setSelectedSource("inventory");
    setSelectedInventoryProduct(product);
    setSelectedCatalogProduct(null);

    setSku(product.sku ?? "");
    setNombre(product.nombre ?? "");
    setDescripcion(product.descripcion ?? "");
    setCantidad("");
    setCaducidad("");
    setCaducidadNoAplica(true);

    setCostoProveedor(Number(product.costo_proveedor ?? 0).toString());
    setPrecioVentaSugerido(
      Number(product.precio_venta_sugerido ?? 0).toString()
    );

    setStockMinimo(Number(product.stock_minimo ?? 10).toString());
    setStockAlto(Number(product.stock_alto ?? 30).toString());

    const [rack, nivel, slot] = product.locationId.split("-");

    setSelectedRack(rack);
    setSelectedNivel(nivel);
    setSelectedSlot(slot);

    setCatalogResults([]);
  };

  const handleSelectCatalogProduct = (item: ProductoCatalogo) => {
    const inventoryProduct =
      findInventoryExactMatch(item.sku) || findInventoryExactMatch(item.nombre);

    if (inventoryProduct) {
      handleSelectInventoryProduct(inventoryProduct);
      return;
    }

    setSelectedSource("catalog");
    setSelectedCatalogProduct(item);
    setSelectedInventoryProduct(null);

    setSku(item.sku ?? "");
    setNombre(item.nombre ?? "");
    setDescripcion(item.descripcion ?? "");
    setCantidad("");
    setCaducidad("");
    setCaducidadNoAplica(true);
    setCostoProveedor("");
    setPrecioVentaSugerido("");
    setStockMinimo("10");
    setStockAlto("30");

    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");

    setCatalogResults([]);
    setActiveLots([]);
  };

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2 || selectedSource) {
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
      } catch (error) {
        console.error("Error buscando catálogo histórico:", error);
        setCatalogResults([]);
      } finally {
        setCatalogLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchTerm, selectedSource]);

  useEffect(() => {
    const loadLots = async () => {
      if (!selectedInventoryProduct?.sku) {
        setActiveLots([]);
        return;
      }

      try {
        setLotsLoading(true);

        const response = await fetch(
          `${API_URL}/productos/${encodeURIComponent(
            selectedInventoryProduct.sku
          )}/lotes`
        );

        if (!response.ok) {
          setActiveLots([]);
          return;
        }

        const data = await response.json();

        setActiveLots(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error cargando lotes del producto:", error);
        setActiveLots([]);
      } finally {
        setLotsLoading(false);
      }
    };

    loadLots();
  }, [selectedInventoryProduct?.sku]);

  const resolveAutocomplete = async (
    term: string,
    options?: { showToast?: boolean }
  ) => {
    if (selectedSource) return;

    const cleanTerm = term.trim();

    if (!cleanTerm) return;

    const cleanTermLower = cleanTerm.toLowerCase();
    const inventoryMatch = findInventoryExactMatch(cleanTermLower);

    if (inventoryMatch) {
      handleSelectInventoryProduct(inventoryMatch);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/catalogo/productos/buscar?query=${encodeURIComponent(
          cleanTerm
        )}`
      );

      if (!response.ok) {
        if (options?.showToast) {
          toast({
            title: "Sin coincidencia exacta",
            description:
              "No se encontró un SKU o nombre exacto. Puedes continuar como producto nuevo.",
          });
        }

        return;
      }

      const data = await response.json();

      const results: ProductoCatalogo[] = Array.isArray(data)
        ? data
        : data?.productos ?? data?.resultados ?? [];

      setCatalogResults(results);

      const catalogMatch = results.find((item) => {
        const itemSku = item.sku?.trim().toLowerCase();
        const itemNombre = item.nombre?.trim().toLowerCase();

        return itemSku === cleanTermLower || itemNombre === cleanTermLower;
      });

      if (catalogMatch) {
        handleSelectCatalogProduct(catalogMatch);
        return;
      }

      if (options?.showToast) {
        toast({
          title: "Sin coincidencia exacta",
          description:
            "No se encontró un SKU o nombre exacto. Puedes continuar como producto nuevo.",
        });
      }
    } catch (error) {
      console.error("Error resolviendo autollenado:", error);

      if (options?.showToast) {
        toast({
          title: "Error",
          description: "No se pudo revisar el catálogo.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAutocompleteEnter = (
    e: React.KeyboardEvent,
    term: string
  ) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    resolveAutocomplete(term, {
      showToast: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSaving) return;

    const finalSku =
      selectedInventoryProduct?.sku ??
      selectedCatalogProduct?.sku ??
      sku.trim();

    const finalNombre =
      selectedInventoryProduct?.nombre ??
      selectedCatalogProduct?.nombre ??
      nombre.trim();

    const manualDescripcion = descripcion.trim();

    const finalDescripcion =
      selectedInventoryProduct?.descripcion ??
      selectedCatalogProduct?.descripcion ??
      (manualDescripcion || null);

    if (!finalSku || !finalNombre) {
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
        description: "El stock crítico debe ser un número mayor a 0.",
        variant: "destructive",
      });

      return;
    }

    const stockAltoNum =
      stockAlto.trim() === "" ? stockMinimoNum * 3 : parseInt(stockAlto);

    if (isNaN(stockAltoNum) || stockAltoNum <= stockMinimoNum) {
      toast({
        title: "Error",
        description: "El stock alto debe ser mayor que el stock crítico.",
        variant: "destructive",
      });

      return;
    }

    let locationId = "";

    if (selectedInventoryProduct) {
      locationId = selectedInventoryProduct.locationId;
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

    const shouldShowFefoNotice = isRestock;
    const shouldWarnFront = newLotExpiresBeforeCurrent;

    try {
      setIsSaving(true);

      await addProduct({
        locationId,
        sku: finalSku,
        nombre: finalNombre,
        descripcion: finalDescripcion || null,
        cantidad: cantidadNum,
        costo_proveedor: costoProveedorNum,
        precio_venta_sugerido: precioVentaSugeridoNum,
        caducidad: caducidadValue,
        stock_minimo: stockMinimoNum,
        stock_alto: stockAltoNum,
      });

      setLastAddedProduct({
        sku: finalSku,
        nombre: finalNombre,
        rack: finalRack,
        nivel: parseInt(finalNivel),
        slot: parseInt(finalSlot),
        timestamp: new Date(),
        descripcion: finalDescripcion || null,
        cantidad: cantidadNum,
        costoProveedor: costoProveedorNum,
        precioVentaSugerido: precioVentaSugeridoNum,
        caducidad: caducidadValue,
      });

      setShowQRConfirmation(true);

      if (shouldShowFefoNotice) {
        setFefoNotice({
          nombre: finalNombre,
          locationId,
          caducidad: caducidadValue,
          expiresBeforeCurrent: shouldWarnFront,
        });
      }

      toast({
        title: isRestock ? "Restock registrado" : "Producto agregado",
        description: isRestock
          ? `Se sumaron ${cantidadNum} pieza(s) a ${finalNombre}. Revisa la regla FEFO en pantalla.`
          : `${finalNombre} fue agregado al inventario.`,
      });

      resetForm();
    } catch (error) {
      console.error("Error agregando producto:", error);

      toast({
        title: "Error",
        description: "No se pudo agregar el producto.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <BlockingLoader
        show={isSaving}
        title={isRestock ? "Registrando restock" : "Guardando producto"}
        description="Estamos enviando la información a la base de datos. No cierres la página ni repitas la acción."
      />

      <div className="space-y-6">
        {fefoNotice && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />

                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Regla FEFO para acomodo físico
                  </h3>

                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Se registró un nuevo lote para{" "}
                    <strong>{fefoNotice.nombre}</strong> en la ubicación{" "}
                    <strong>{fefoNotice.locationId}</strong>.
                  </p>

                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    RackNova descontará primero el lote que caduca antes. Para
                    mantener datos correctos, coloca físicamente el producto con
                    caducidad más próxima al frente y el nuevo lote detrás si
                    caduca después.
                  </p>

                  {fefoNotice.caducidad && (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Caducidad del nuevo lote:{" "}
                      <strong>
                        {formatDateDDMMYYYY(fefoNotice.caducidad)}
                      </strong>
                      .
                    </p>
                  )}

                  {fefoNotice.expiresBeforeCurrent && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      Atención: este nuevo lote caduca antes que los lotes
                      actuales. Debe colocarse al frente.
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFefoNotice(null)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Agregar Nuevo Producto
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="h-4 w-4" />
                    Información del Producto
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">
                        Catálogo histórico e inventario actual
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Escribe un SKU o nombre. RackNova mostrará coincidencias
                      mientras escribes. Para autollenar, presiona Enter, da
                      click en una coincidencia o sal del campo cuando el dato ya
                      esté completo.
                    </p>

                    {catalogLoading && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Buscando coincidencias...
                      </p>
                    )}

                    {!selectedSource && catalogResults.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-lg border bg-background">
                        <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                          Coincidencias encontradas:
                        </p>

                        {catalogResults.map((item) => (
                          <button
                            key={item.sku}
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              handleSelectCatalogProduct(item);
                            }}
                            disabled={isSaving}
                            className="w-full cursor-pointer border-b p-3 text-left last:border-b-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <p className="font-medium">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.sku}
                            </p>

                            {item.descripcion && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.descripcion}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedSource && (
                      <div className="mt-3 rounded-lg border bg-background p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              <Lock className="h-4 w-4" />
                              {selectedSource === "inventory"
                                ? "Producto cargado desde inventario actual"
                                : "Producto cargado desde catálogo histórico"}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              SKU, nombre y descripción quedan bloqueados para
                              evitar duplicados. Cantidad y caducidad pertenecen
                              a la nueva entrada y deben capturarse manualmente.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearHistoricalSelection}
                            disabled={isSaving}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Cambiar
                          </Button>
                        </div>
                      </div>
                    )}

                    {isRestock && selectedInventoryProduct && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                          Restock detectado
                        </p>

                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          Este producto ya existe en inventario. RackNova sumará
                          la nueva cantidad, conservará la ubicación{" "}
                          <strong>{selectedInventoryProduct.locationId}</strong>
                          , recalculará el costo promedio y creará un lote nuevo
                          con la caducidad capturada.
                        </p>
                      </div>
                    )}
                  </div>

                  {isRestock && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Layers className="h-4 w-4" />
                          Lotes activos del producto
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        {lotsLoading && (
                          <p className="text-sm text-muted-foreground">
                            Cargando lotes...
                          </p>
                        )}

                        {!lotsLoading && activeLots.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No hay lotes activos registrados todavía.
                          </p>
                        )}

                        {!lotsLoading && activeLots.length > 0 && (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {activeLots.map((lot) => (
                              <div
                                key={lot.id_lote ?? `${lot.sku}-${lot.caducidad}`}
                                className="rounded-lg border bg-muted/30 p-3"
                              >
                                <p className="text-sm font-semibold">
                                  Lote #{lot.id_lote ?? "N/A"}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  Caducidad:{" "}
                                  {formatDateDDMMYYYY(lot.caducidad)}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {lot.cantidad_actual} pza(s)
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  Costo: $
                                  {Number(lot.costo_unitario ?? 0).toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {earliestLot && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Lote con caducidad más próxima:{" "}
                            <strong>
                              {formatDateDDMMYYYY(earliestLot.caducidad)}
                            </strong>
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU *</Label>

                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                        <Input
                          id="sku"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          onKeyDown={(e) => handleAutocompleteEnter(e, sku)}
                          onBlur={(e) => {
                            resolveAutocomplete(e.target.value, {
                              showToast: false,
                            });
                          }}
                          placeholder="Ej: SKU001"
                          className="pl-9"
                          required
                          disabled={identityLocked || isSaving}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Producto *</Label>

                      <Input
                        id="nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        onKeyDown={(e) =>
                          handleAutocompleteEnter(e, nombre)
                        }
                        onBlur={(e) => {
                          resolveAutocomplete(e.target.value, {
                            showToast: false,
                          });
                        }}
                        placeholder="Ej: Coca Cola 600 ml"
                        required
                        disabled={identityLocked || isSaving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cantidad">
                        {isRestock
                          ? "Cantidad nueva a ingresar *"
                          : "Cantidad *"}
                      </Label>

                      <Input
                        id="cantidad"
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder="Ej: 100"
                        min="1"
                        required
                        disabled={isSaving}
                      />

                      {isRestock && selectedInventoryProduct && (
                        <p className="text-xs text-muted-foreground">
                          Stock actual: {selectedInventoryProduct.cantidad}{" "}
                          pieza(s). Esta cantidad se sumará al inventario.
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
                        disabled={isSaving}
                      />

                      <p className="text-xs text-muted-foreground">
                        En restock se usa para recalcular el costo promedio.
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
                        onChange={(e) =>
                          setPrecioVentaSugerido(e.target.value)
                        }
                        placeholder="Ej: 120.00"
                        min="0"
                        step="0.01"
                        required
                        disabled={isSaving}
                      />

                      <p className="text-xs text-muted-foreground">
                        Se guardará como precio sugerido más reciente.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockMinimo">
                        Stock crítico / mínimo
                      </Label>

                      <Input
                        id="stockMinimo"
                        type="number"
                        value={stockMinimo}
                        onChange={(e) => setStockMinimo(e.target.value)}
                        placeholder="Por defecto: 10"
                        min="1"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockAlto">Stock alto</Label>

                      <Input
                        id="stockAlto"
                        type="number"
                        value={stockAlto}
                        onChange={(e) => setStockAlto(e.target.value)}
                        placeholder="Por defecto: stock crítico x 3"
                        min="1"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Caducidad del nuevo lote</Label>

                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={caducidadNoAplica}
                            disabled={isSaving}
                            onChange={(e) => {
                              setCaducidadNoAplica(e.target.checked);

                              if (e.target.checked) {
                                setCaducidad("");
                              }
                            }}
                          />
                          No aplica
                        </label>
                      </div>

                      <DateInputMX
                        value={caducidad}
                        onChange={setCaducidad}
                        disabled={caducidadNoAplica || isSaving}
                        placeholder="dd/mm/aaaa"
                      />

                      <p className="text-xs text-muted-foreground">
                        Captura la fecha en formato dd/mm/aaaa. Internamente se
                        guardará de forma segura para la base de datos.
                      </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="descripcion">Descripción</Label>

                      <Textarea
                        id="descripcion"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Descripción adicional del producto..."
                        rows={3}
                        disabled={identityLocked || isSaving}
                      />

                      {identityLocked && (
                        <p className="text-xs text-muted-foreground">
                          La descripción pertenece a la identidad histórica del
                          producto y no se puede editar desde este formulario.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-4 w-4" />
                    Ubicación en Inventario
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {locationLocked && selectedInventoryProduct ? (
                    <div className="rounded-md border bg-muted/40 p-4">
                      <p className="text-sm font-semibold">
                        Ubicación fija por restock
                      </p>

                      <p className="mt-1 font-mono text-sm">
                        {selectedInventoryProduct.locationId}
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Como el producto ya está en inventario, RackNova usará
                        la misma ubicación y no permitirá seleccionar otra.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="rack">Rack *</Label>

                        <Select
                          value={selectedRack}
                          disabled={isSaving}
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
                          disabled={!selectedRack || isSaving}
                          onValueChange={(value) => {
                            setSelectedNivel(value);
                            setSelectedSlot("");
                          }}
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
                          disabled={
                            !selectedNivel ||
                            availableSlots.length === 0 ||
                            isSaving
                          }
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
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-sm text-muted-foreground">
                            <strong>Ubicación seleccionada:</strong>
                          </p>

                          <p className="font-mono text-sm">
                            {selectedRack}-{selectedNivel}-
                            {selectedSlot || "?"}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {availableSlots.length} slots disponibles en este
                            nivel
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSaving}
                >
                  Limpiar Formulario
                </Button>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {isRestock ? "Registrar Restock" : "Agregar Producto"}
                    </>
                  )}
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
    </>
  );
}
