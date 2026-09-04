import React, { useEffect, useMemo, useState } from "react";
import { DateInputMX } from "@/components/ui/date-input-mx";
import { BlockingLoader } from "@/components/ui/blocking-loader";
import { apiFetch } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
import { LocationLabelModal } from "./LocationLabelModal";
import { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";
import { useRackNovaScanner } from "@/hooks/useRackNovaScanner";
import type { RackNovaScanResult } from "@/lib/racknovaScan";
import {
  DEFAULT_SCAN_CONFIG,
  crearUbicacionScan,
  desactivarUbicacionScan,
  obtenerConfiguracionScan,
  guardarConfiguracionScan,
  type RackNovaLocationIdentity,
  type RackNovaScanConfig,
} from "@/lib/scanControl";

import {
  Package,
  Plus,
  MapPin,
  Search,
  ScanLine,
  Camera,
  CheckCircle2,
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
type UnidadManejo = "pieza" | "kg" | "litro";

const UNIDADES_MANEJO: Record<
  UnidadManejo,
  {
    etiqueta: string;
    etiquetaPlural: string;
    simbolo: string;
    factor: number;
    paso: number;
    unidadInterna: string;
  }
> = {
  pieza: {
    etiqueta: "pieza",
    etiquetaPlural: "piezas",
    simbolo: "pza",
    factor: 1,
    paso: 1,
    unidadInterna: "pieza",
  },
  kg: {
    etiqueta: "kilogramo",
    etiquetaPlural: "kilogramos",
    simbolo: "kg",
    factor: 1000,
    paso: 0.001,
    unidadInterna: "gramo",
  },
  litro: {
    etiqueta: "litro",
    etiquetaPlural: "litros",
    simbolo: "L",
    factor: 1000,
    paso: 0.001,
    unidadInterna: "mililitro",
  },
};

const numeroParaInput = (value: number, decimals = 3) =>
  Number(Number(value || 0).toFixed(decimals)).toString();

const unidadNormalizada = (value: unknown): UnidadManejo => {
  const clean = String(value || "pieza").trim().toLowerCase();
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(clean)) {
    return "kg";
  }
  if (["l", "lt", "lts", "litro", "litros"].includes(clean)) {
    return "litro";
  }
  return "pieza";
};

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
  const [unidadManejo, setUnidadManejo] =
    useState<UnidadManejo>("pieza");
  const [unidadLoading, setUnidadLoading] = useState(false);

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

  const [isSaving, setIsSaving] = useState(false);
  const [scanConfig, setScanConfig] =
    useState<RackNovaScanConfig>(DEFAULT_SCAN_CONFIG);
  const [locationVerified, setLocationVerified] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState<{
    location: RackNovaLocationIdentity;
    productName: string;
  } | null>(null);

  const { products, addProduct } = useInventory();

  const { toast } = useToast();

  const identityLocked =
    selectedSource === "inventory" || selectedSource === "catalog";

  const isRestock = selectedSource === "inventory";
  const unidadActual = UNIDADES_MANEJO[unidadManejo];
  const factorInventario = unidadActual.factor;
  const pasoCantidad = unidadActual.paso;
  const stockActualComercial = selectedInventoryProduct
    ? Number(selectedInventoryProduct.cantidad || 0) / factorInventario
    : 0;


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

  useEffect(() => {
    void obtenerConfiguracionScan().then(setScanConfig);

    const handleConfig = (event: Event) => {
      const custom = event as CustomEvent<RackNovaScanConfig>;
      if (custom.detail) setScanConfig(custom.detail);
    };

    window.addEventListener("racknova:scan-config-local", handleConfig);
    return () =>
      window.removeEventListener("racknova:scan-config-local", handleConfig);
  }, []);

  const handleLocationScan = (scan: RackNovaScanResult) => {
    const expected = selectedInventoryProduct?.locationId?.trim();
    if (!expected || !expected.startsWith("RNLOC:")) return;

    if (scan.code.trim() === expected) {
      setLocationVerified(true);
      toast({
        title: "Ubicación confirmada",
        description: "La etiqueta coincide con el lugar asignado al producto.",
      });
      return;
    }

    if (scan.code.trim().startsWith("RNLOC:")) {
      setLocationVerified(false);
      toast({
        title: "Ubicación incorrecta",
        description: "Esa etiqueta pertenece a otro punto físico.",
        variant: "destructive",
      });
    }
  };

  useRackNovaScanner({
    enabled:
      Boolean(selectedInventoryProduct) &&
      scanConfig.ubicacion_verificacion_requerida &&
      scanConfig.hid_habilitado,
    onScan: handleLocationScan,
  });

  useEffect(() => {
    setLocationVerified(false);
  }, [selectedInventoryProduct?.sku]);

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
    setUnidadManejo("pieza");
    setUnidadLoading(false);
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

    setSelectedRack("");
    setSelectedNivel("");
    setSelectedSlot("");
    setLocationVerified(false);

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
    setUnidadManejo("pieza");

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

        const response = await apiFetch(
  `/catalogo/productos/buscar?query=${encodeURIComponent(searchTerm)}`
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
    const selectedSku =
      selectedInventoryProduct?.sku ?? selectedCatalogProduct?.sku ?? "";

    if (!selectedSku) return;

    let cancelled = false;

    const loadUnit = async () => {
      try {
        setUnidadLoading(true);
        const response = await apiFetch(
          `/pos/v3/productos/unidad/${encodeURIComponent(selectedSku)}`
        );

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        const nextUnit = unidadNormalizada(data?.unidad_venta);
        const nextFactor = Number(data?.factor_inventario || 1) || 1;
        setUnidadManejo(nextUnit);

        if (selectedInventoryProduct) {
          setCostoProveedor(
            numeroParaInput(
              Number(selectedInventoryProduct.costo_proveedor || 0) *
                nextFactor,
              4
            )
          );
          setPrecioVentaSugerido(
            numeroParaInput(
              Number(selectedInventoryProduct.precio_venta_sugerido || 0),
              2
            )
          );
          setStockMinimo(
            numeroParaInput(
              Number(selectedInventoryProduct.stock_minimo || 0) / nextFactor
            )
          );
          setStockAlto(
            numeroParaInput(
              Number(selectedInventoryProduct.stock_alto || 0) / nextFactor
            )
          );
        }
      } catch (error) {
        console.error("Error cargando unidad del producto:", error);
        if (!cancelled) setUnidadManejo("pieza");
      } finally {
        if (!cancelled) setUnidadLoading(false);
      }
    };

    void loadUnit();

    return () => {
      cancelled = true;
    };
  }, [
    selectedInventoryProduct,
    selectedCatalogProduct?.sku,
  ]);

  useEffect(() => {
    const loadLots = async () => {
      if (!selectedInventoryProduct?.sku) {
        setActiveLots([]);
        return;
      }

      try {
        setLotsLoading(true);

        const response = await apiFetch(
  `/productos/${encodeURIComponent(selectedInventoryProduct.sku)}/lotes`
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
    const response = await apiFetch(
  `/catalogo/productos/buscar?query=${encodeURIComponent(cleanTerm)}`
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

  const updateEntryScanPreference = async (
    patch: Partial<RackNovaScanConfig>
  ) => {
    const previous = scanConfig;
    const optimistic = { ...scanConfig, ...patch };
    setScanConfig(optimistic);

    try {
      const saved = await guardarConfiguracionScan(patch);
      setScanConfig(saved);
    } catch (error) {
      setScanConfig(previous);
      toast({
        title: "No se pudo guardar la preferencia",
        description:
          error instanceof Error
            ? error.message
            : "Intenta nuevamente.",
        variant: "destructive",
      });
    }
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

    const cantidadComercial = Number(cantidad);
    if (!Number.isFinite(cantidadComercial) || cantidadComercial <= 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser un número positivo.",
        variant: "destructive",
      });
      return;
    }

    if (
      unidadManejo === "pieza" &&
      !Number.isInteger(cantidadComercial)
    ) {
      toast({
        title: "Cantidad inválida",
        description: "Los productos por pieza deben usar números enteros.",
        variant: "destructive",
      });
      return;
    }

    const cantidadInternaExacta =
      cantidadComercial * factorInventario;
    const cantidadNum = Math.round(cantidadInternaExacta);

    if (
      cantidadNum <= 0 ||
      Math.abs(cantidadInternaExacta - cantidadNum) > 0.000001
    ) {
      toast({
        title: "Precisión inválida",
        description:
          unidadManejo === "pieza"
            ? "Captura piezas completas."
            : `Captura máximo 3 decimales en ${unidadActual.simbolo}.`,
        variant: "destructive",
      });
      return;
    }

    const costoProveedorComercial = Number(costoProveedor);
    if (
      !Number.isFinite(costoProveedorComercial) ||
      costoProveedorComercial < 0
    ) {
      toast({
        title: "Error",
        description: "El costo proveedor debe ser un número válido.",
        variant: "destructive",
      });
      return;
    }

    const costoProveedorNum =
      costoProveedorComercial / factorInventario;

    const precioVentaSugeridoNum = Number(precioVentaSugerido);
    if (
      !Number.isFinite(precioVentaSugeridoNum) ||
      precioVentaSugeridoNum < 0
    ) {
      toast({
        title: "Error",
        description: "El precio de venta sugerido debe ser un número válido.",
        variant: "destructive",
      });
      return;
    }

    const stockMinimoComercial =
      stockMinimo.trim() === "" ? 10 : Number(stockMinimo);
    if (
      !Number.isFinite(stockMinimoComercial) ||
      stockMinimoComercial <= 0
    ) {
      toast({
        title: "Error",
        description: "El stock crítico debe ser un número mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    const stockAltoComercial =
      stockAlto.trim() === ""
        ? stockMinimoComercial * 3
        : Number(stockAlto);
    if (
      !Number.isFinite(stockAltoComercial) ||
      stockAltoComercial <= stockMinimoComercial
    ) {
      toast({
        title: "Error",
        description: "El stock alto debe ser mayor que el stock crítico.",
        variant: "destructive",
      });
      return;
    }

    const stockMinimoNum = Math.round(
      stockMinimoComercial * factorInventario
    );
    const stockAltoNum = Math.round(
      stockAltoComercial * factorInventario
    );

    let locationId = selectedInventoryProduct?.locationId?.trim() || "";
    const alreadyHasFreeLocation = locationId.startsWith("RNLOC:");

    if (
      isRestock &&
      alreadyHasFreeLocation &&
      scanConfig.ubicacion_verificacion_requerida &&
      !locationVerified
    ) {
      toast({
        title: "Confirma la ubicación",
        description:
          "Escanea la etiqueta física asignada antes de registrar este restock.",
        variant: "destructive",
      });
      return;
    }

    let createdLocationForThisEntry: RackNovaLocationIdentity | null = null;
    let inventorySaved = false;

    const caducidadValue =
      caducidadNoAplica || !caducidad ? null : caducidad;

    const shouldShowFefoNotice = isRestock;
    const shouldWarnFront = newLotExpiresBeforeCurrent;

    try {
      setIsSaving(true);

      if (!locationId.startsWith("RNLOC:")) {
        createdLocationForThisEntry = await crearUbicacionScan({
          nombre: `Ubicación de ${finalNombre}`,
          descripcion: `Punto físico asignado a ${finalNombre} (${finalSku}).`,
        });
        locationId = createdLocationForThisEntry.codigo_ubicacion;
      }

      const unitResponse = await apiFetch(
        `/pos/v3/productos/unidad/${encodeURIComponent(finalSku)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unidad_venta: unidadManejo }),
        }
      );

      if (!unitResponse.ok) {
        let detail = "No se pudo guardar la unidad del producto.";
        try {
          const errorData = await unitResponse.json();
          detail = errorData?.detail || detail;
        } catch {
          // La respuesta no era JSON.
        }
        throw new Error(detail);
      }

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
      inventorySaved = true;

      if (createdLocationForThisEntry) {
        setLocationLabel({
          location: createdLocationForThisEntry,
          productName: finalNombre,
        });
      }

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
          ? `Se sumaron ${numeroParaInput(cantidadComercial)} ${unidadActual.simbolo} a ${finalNombre}. Revisa la regla FEFO en pantalla.`
          : `${finalNombre} fue agregado al inventario.`,
      });

      resetForm();
    } catch (error) {
      console.error("Error agregando producto:", error);

      if (createdLocationForThisEntry && !inventorySaved) {
        void desactivarUbicacionScan(createdLocationForThisEntry.id_ubicacion).catch(
          () => undefined
        );
      }

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo agregar el producto.",
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
                          la nueva cantidad y lo mantendrá asociado a{" "}
                          <strong>{selectedInventoryProduct.locationId}</strong>.
                          Si todavía usa una ubicación heredada, esta entrada la
                          convertirá a una etiqueta libre RNLOC.
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
                                  {numeroParaInput(
                                    Number(lot.cantidad_actual || 0) /
                                      factorInventario
                                  )}{" "}
                                  {unidadActual.simbolo}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  Costo: $
                                  {(
                                    Number(lot.costo_unitario ?? 0) *
                                    factorInventario
                                  ).toFixed(2)}{" "}
                                  por {unidadActual.simbolo}
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
                      <Label>Unidad de manejo *</Label>
                      <Select
                        value={unidadManejo}
                        disabled={isSaving || unidadLoading || isRestock}
                        onValueChange={(value) =>
                          setUnidadManejo(value as UnidadManejo)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pieza">Pieza</SelectItem>
                          <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                          <SelectItem value="litro">Litro (L)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {unidadLoading
                          ? "Consultando la unidad configurada..."
                          : isRestock
                            ? "La unidad queda bloqueada durante el restock."
                            : unidadManejo === "pieza"
                              ? "El inventario se administrará en piezas completas."
                              : `RackNova guardará internamente ${unidadActual.unidadInterna}s y mostrará ${unidadActual.etiquetaPlural}.`}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cantidad">
                        {isRestock
                          ? `Cantidad nueva a ingresar (${unidadActual.simbolo}) *`
                          : `Cantidad (${unidadActual.simbolo}) *`}
                      </Label>
                      <Input
                        id="cantidad"
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder={
                          unidadManejo === "pieza" ? "Ej: 100" : "Ej: 12.500"
                        }
                        min={pasoCantidad}
                        step={pasoCantidad}
                        required
                        disabled={isSaving || unidadLoading}
                      />
                      {isRestock && selectedInventoryProduct && (
                        <p className="text-xs text-muted-foreground">
                          Stock actual:{" "}
                          {numeroParaInput(stockActualComercial)}{" "}
                          {unidadActual.simbolo}. Esta cantidad se sumará al
                          inventario.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="costoProveedor">
                        Costo proveedor por {unidadActual.simbolo} *
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
                        disabled={isSaving || unidadLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        En restock se usa para recalcular el costo promedio.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="precioVentaSugerido">
                        Precio de venta por {unidadActual.simbolo} *
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
                        disabled={isSaving || unidadLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        El Punto de Venta cobrará este precio por{" "}
                        {unidadActual.simbolo}.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockMinimo">
                        Stock crítico ({unidadActual.simbolo})
                      </Label>
                      <Input
                        id="stockMinimo"
                        type="number"
                        value={stockMinimo}
                        onChange={(e) => setStockMinimo(e.target.value)}
                        placeholder="Por defecto: 10"
                        min={pasoCantidad}
                        step={pasoCantidad}
                        disabled={isSaving || unidadLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockAlto">
                        Stock alto ({unidadActual.simbolo})
                      </Label>
                      <Input
                        id="stockAlto"
                        type="number"
                        value={stockAlto}
                        onChange={(e) => setStockAlto(e.target.value)}
                        placeholder="Por defecto: stock crítico x 3"
                        min={pasoCantidad}
                        step={pasoCantidad}
                        disabled={isSaving || unidadLoading}
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

              <Card className="overflow-hidden border-violet-500/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-4 w-4 text-violet-600" />
                    Ubicación física libre
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="mb-4">
                      <p className="text-sm font-bold">Control de acomodo en este dispositivo</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Estas opciones son locales. Cambiarlas aquí no obliga a otras
                        cajas, computadoras o celulares a trabajar igual.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-semibold">Confirmar acomodo</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            Exige escanear la ubicación al reabastecer.
                          </p>
                        </div>
                        <Switch
                          checked={scanConfig.ubicacion_verificacion_requerida}
                          disabled={!scanConfig.hid_habilitado && !scanConfig.camara_habilitada}
                          onCheckedChange={(value) =>
                            void updateEntryScanPreference({
                              ubicacion_verificacion_requerida: value,
                            })
                          }
                          aria-label="Confirmar acomodo con escaneo"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-semibold">Pistola USB / Bluetooth</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            Acepta lectores tipo teclado HID.
                          </p>
                        </div>
                        <Switch
                          checked={scanConfig.hid_habilitado}
                          onCheckedChange={(value) =>
                            void updateEntryScanPreference({ hid_habilitado: value })
                          }
                          aria-label="Lector HID para entrada"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-semibold">Cámara</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            Permite confirmar con cámara del dispositivo.
                          </p>
                        </div>
                        <Switch
                          checked={scanConfig.camara_habilitada}
                          onCheckedChange={(value) =>
                            void updateEntryScanPreference({ camara_habilitada: value })
                          }
                          aria-label="Cámara para entrada"
                        />
                      </label>
                    </div>

                    {!scanConfig.hid_habilitado && !scanConfig.camara_habilitada && (
                      <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                        Activa al menos un lector antes de exigir confirmación de acomodo.
                      </p>
                    )}
                  </div>

                  {!isRestock && (
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <p className="font-semibold">Tú decides dónde va el producto</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        No necesitas crear racks, niveles ni posiciones. Al guardar,
                        RackNova generará una etiqueta QR + Code128. Coloca el
                        producto donde quieras y pega la etiqueta exactamente ahí.
                      </p>
                    </div>
                  )}

                  {isRestock && selectedInventoryProduct?.locationId.startsWith("RNLOC:") && (
                    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                      <div>
                        <p className="text-sm font-semibold">Ubicación asignada</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                          {selectedInventoryProduct.locationId}
                        </p>
                      </div>

                      {scanConfig.ubicacion_verificacion_requerida ? (
                        <div className={`rounded-xl border p-3 ${locationVerified ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                          <div className="flex items-start gap-3">
                            {locationVerified ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                            ) : (
                              <ScanLine className="mt-0.5 h-5 w-5 text-amber-600" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-semibold">
                                {locationVerified
                                  ? "Ubicación confirmada"
                                  : "Escanea la etiqueta donde vas a acomodarlo"}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {locationVerified
                                  ? "La lectura coincide con la ubicación guardada."
                                  : "Esto confirma físicamente que el reabastecimiento va al mismo lugar."}
                              </p>
                              {!locationVerified && scanConfig.camara_habilitada && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-3"
                                  onClick={() => setCameraScannerOpen(true)}
                                >
                                  <Camera className="mr-2 h-4 w-4" />
                                  Usar cámara
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-5 text-muted-foreground">
                          La confirmación física está desactivada en este dispositivo.
                          RackNova te muestra la ubicación, pero no te obliga a escanearla.
                        </p>
                      )}
                    </div>
                  )}

                  {isRestock && selectedInventoryProduct && !selectedInventoryProduct.locationId.startsWith("RNLOC:") && (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                      <p className="font-semibold">Migración automática a ubicación libre</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Este producto todavía usa la ubicación anterior{" "}
                        <strong>{selectedInventoryProduct.locationId}</strong>. Al
                        registrar esta entrada, RackNova generará una nueva etiqueta
                        RNLOC para que la pegues donde realmente guardas el artículo.
                      </p>
                    </div>
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

        <LocationLabelModal
          open={Boolean(locationLabel)}
          onOpenChange={(open) => {
            if (!open) setLocationLabel(null);
          }}
          location={locationLabel?.location ?? null}
          productName={locationLabel?.productName ?? null}
        />

        <RackNovaScannerDialog
          open={cameraScannerOpen}
          onOpenChange={setCameraScannerOpen}
          onScan={handleLocationScan}
          title="Confirmar ubicación de acomodo"
          description="Escanea la etiqueta RackNova pegada en el lugar donde vas a colocar este producto."
        />
      </div>
    </>
  );
}
