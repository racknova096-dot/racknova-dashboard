import React, { useEffect, useMemo, useState } from "react";
import { DateInputMX } from "@/components/ui/date-input-mx";
import { BlockingLoader } from "@/components/ui/blocking-loader";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
import { apiFetch } from "@/lib/api";
import { useInventory } from "@/context/InventoryContext";
import { Location, Product } from "@/types/inventory";
import { useToast } from "@/hooks/use-toast";
import { QRConfirmationModal } from "./QRConfirmationModal";

import {
  AlertTriangle,
  Percent,
  LocateFixed,
  Loader2,
} from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  product: Product | null;
  mode: "add" | "edit";
}

// RACKNOVA_UNIDADES_MODAL
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

const numeroComercial = (value: number, decimals = 3) =>
  Number(Number(value || 0).toFixed(decimals)).toString();

const cantidadInterna = (
  value: number,
  unidad: UnidadManejo
): number | null => {
  const exact = value * UNIDADES_MANEJO[unidad].factor;
  const rounded = Math.round(exact);

  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.abs(exact - rounded) > 0.000001
  ) {
    return null;
  }

  return rounded;
};

function getDaysToExpiration(dateValue?: string | null) {
  if (!dateValue) return null;

  const cleanDate = dateValue.slice(0, 10);
  const expirationDate = new Date(`${cleanDate}T00:00:00`);
  const today = new Date();

  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs = expirationDate.getTime() - todayClean.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getDiscountSuggestion(daysToExpiration: number | null) {
  if (daysToExpiration === null) return 0;

  if (daysToExpiration < 0) return 0;
  if (daysToExpiration <= 5) return 40;
  if (daysToExpiration <= 10) return 30;
  if (daysToExpiration <= 15) return 20;
  if (daysToExpiration <= 30) return 10;

  return 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

export function ProductModal({
  isOpen,
  onClose,
  location,
  product,
  mode,
}: ProductModalProps) {
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoProveedor, setCostoProveedor] = useState("");
  const [precioVentaSugerido, setPrecioVentaSugerido] = useState("");
  const [caducidad, setCaducidad] = useState("");
  const [caducidadNoAplica, setCaducidadNoAplica] = useState(true);
  const [stockMinimo, setStockMinimo] = useState("");
  const [stockAlto, setStockAlto] = useState("");
  const [unidadManejo, setUnidadManejo] =
    useState<UnidadManejo>("pieza");
  const [unidadLoading, setUnidadLoading] = useState(false);

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [cantidadVendida, setCantidadVendida] = useState("1");
  const [precioVenta, setPrecioVenta] = useState("");

  const [showQRConfirmation, setShowQRConfirmation] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isSearchingPhysical, setIsSearchingPhysical] = useState(false);

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

  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    buscarFisicamente,
  } = useInventory();

  const { toast } = useToast();

  const unidadActual = UNIDADES_MANEJO[unidadManejo];
  const factorInventario = unidadActual.factor;
  const stockDisponibleComercial = product
    ? Number(product.cantidad || 0) / factorInventario
    : 0;
  const costoProveedorComercial = product
    ? Number(product.costo_proveedor || 0) * factorInventario
    : 0;

  useEffect(() => {
    if (!isOpen) return;

    if (mode !== "edit" || !product) {
      setSku("");
      setNombre("");
      setCantidad("");
      setCostoProveedor("");
      setPrecioVentaSugerido("");
      setCaducidad("");
      setCaducidadNoAplica(true);
      setStockMinimo("");
      setStockAlto("");
      setUnidadManejo("pieza");
      setUnidadLoading(false);
      return;
    }

    let cancelled = false;

    const loadProductUnit = async () => {
      try {
        setUnidadLoading(true);

        const response = await apiFetch(
          `/pos/v3/productos/unidad/${encodeURIComponent(product.sku)}`
        );

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        const nextUnit = unidadNormalizada(data?.unidad_venta);
        const nextFactor = Number(data?.factor_inventario || 1) || 1;

        setUnidadManejo(nextUnit);
        setSku(product.sku);
        setNombre(product.nombre);
        setCantidad(
          numeroComercial(Number(product.cantidad || 0) / nextFactor)
        );
        setCostoProveedor(
          numeroComercial(
            Number(product.costo_proveedor || 0) * nextFactor,
            4
          )
        );
        setPrecioVentaSugerido(
          numeroComercial(Number(product.precio_venta_sugerido || 0), 2)
        );
        setCaducidad(
          product.caducidad ? product.caducidad.slice(0, 10) : ""
        );
        setCaducidadNoAplica(!product.caducidad);
        setStockMinimo(
          numeroComercial(Number(product.stock_minimo || 0) / nextFactor)
        );
        setStockAlto(
          numeroComercial(Number(product.stock_alto || 0) / nextFactor)
        );
      } catch (error) {
        console.error("Error cargando unidad del producto:", error);

        if (!cancelled) {
          setUnidadManejo("pieza");
          setSku(product.sku);
          setNombre(product.nombre);
          setCantidad(product.cantidad.toString());
          setCostoProveedor(product.costo_proveedor?.toString() ?? "0");
          setPrecioVentaSugerido(
            product.precio_venta_sugerido?.toString() ?? "0"
          );
          setCaducidad(
            product.caducidad ? product.caducidad.slice(0, 10) : ""
          );
          setCaducidadNoAplica(!product.caducidad);
          setStockMinimo(product.stock_minimo?.toString() ?? "");
          setStockAlto(product.stock_alto?.toString() ?? "");
        }
      } finally {
        if (!cancelled) setUnidadLoading(false);
      }
    };

    void loadProductUnit();

    return () => {
      cancelled = true;
    };
  }, [mode, product, isOpen]);

  const diasCaducidad = useMemo(() => {
    return product ? getDaysToExpiration(product.caducidad) : null;
  }, [product]);

  const descuentoSugerido = useMemo(() => {
    return getDiscountSuggestion(diasCaducidad);
  }, [diasCaducidad]);

  const precioBaseDescuento = Number(
    precioVenta || product?.precio_venta_sugerido || 0
  );

  const precioConDescuento =
    precioBaseDescuento > 0 && descuentoSugerido > 0
      ? precioBaseDescuento * (1 - descuentoSugerido / 100)
      : 0;

  const cantidadSalidaNum = Number(cantidadVendida || 0);
  const ingresoEstimado = Number(precioVenta || 0) * cantidadSalidaNum;
  const costoSalidaEstimado =
    costoProveedorComercial * cantidadSalidaNum;
  const gananciaEstimada = ingresoEstimado - costoSalidaEstimado;

  const recuperacionConDescuento =
    precioConDescuento > 0 ? precioConDescuento * cantidadSalidaNum : 0;

  const resultadoConDescuento =
    recuperacionConDescuento > 0
      ? recuperacionConDescuento - costoSalidaEstimado
      : 0;

  const productoTieneDescuento =
    product &&
    diasCaducidad !== null &&
    diasCaducidad >= 0 &&
    descuentoSugerido > 0;

  const productoVencido =
    product && diasCaducidad !== null && diasCaducidad < 0;

  const validateBaseFields = () => {
    if (!location) {
      toast({
        title: "Ubicación no disponible",
        description: "No se encontró la ubicación del slot.",
        variant: "destructive",
      });
      return false;
    }

    if (!sku.trim() || !nombre.trim()) {
      toast({
        title: "Error",
        description: "El SKU y el nombre son obligatorios.",
        variant: "destructive",
      });
      return false;
    }

    const cantidadComercial = Number(cantidad);
    const cantidadConvertida = cantidadInterna(
      cantidadComercial,
      unidadManejo
    );

    if (cantidadConvertida === null) {
      toast({
        title: "Cantidad inválida",
        description:
          unidadManejo === "pieza"
            ? "Las piezas deben capturarse con números enteros."
            : `Captura máximo 3 decimales en ${unidadActual.simbolo}.`,
        variant: "destructive",
      });
      return false;
    }

    const costoComercial = Number(costoProveedor);
    if (!Number.isFinite(costoComercial) || costoComercial < 0) {
      toast({
        title: "Error",
        description: "El costo proveedor debe ser un número válido.",
        variant: "destructive",
      });
      return false;
    }

    const precioComercial = Number(precioVentaSugerido);
    if (!Number.isFinite(precioComercial) || precioComercial < 0) {
      toast({
        title: "Error",
        description: "El precio de venta sugerido debe ser válido.",
        variant: "destructive",
      });
      return false;
    }

    const stockMinimoComercial =
      stockMinimo.trim() === "" ? 10 : Number(stockMinimo);
    const stockAltoComercial =
      stockAlto.trim() === ""
        ? stockMinimoComercial * 3
        : Number(stockAlto);

    if (
      !Number.isFinite(stockMinimoComercial) ||
      stockMinimoComercial <= 0
    ) {
      toast({
        title: "Error",
        description: "El stock crítico debe ser mayor a 0.",
        variant: "destructive",
      });
      return false;
    }

    if (
      !Number.isFinite(stockAltoComercial) ||
      stockAltoComercial <= stockMinimoComercial
    ) {
      toast({
        title: "Error",
        description: "El stock alto debe ser mayor al stock crítico.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSaving || unidadLoading) return;
    if (!validateBaseFields()) return;
    if (!location) return;

    const finalSku = sku.trim();
    const cantidadComercial = Number(cantidad);
    const cantidadNum = cantidadInterna(cantidadComercial, unidadManejo);

    if (cantidadNum === null) return;

    const costoProveedorComercialNum = Number(costoProveedor);
    const costoProveedorNum =
      costoProveedorComercialNum / factorInventario;
    const precioVentaSugeridoNum = Number(precioVentaSugerido);

    const stockMinimoComercial =
      stockMinimo.trim() === "" ? 10 : Number(stockMinimo);
    const stockAltoComercial =
      stockAlto.trim() === ""
        ? stockMinimoComercial * 3
        : Number(stockAlto);

    const stockMinimoNum = Math.round(
      stockMinimoComercial * factorInventario
    );
    const stockAltoNum = Math.round(
      stockAltoComercial * factorInventario
    );

    const caducidadValue =
      caducidadNoAplica || !caducidad ? null : caducidad;

    try {
      setIsSaving(true);

      if (mode === "add") {
        const skuDuplicado = products.some(
          (item) => item.sku.toLowerCase() === finalSku.toLowerCase()
        );

        if (skuDuplicado) {
          toast({
            title: "SKU duplicado",
            description: `El SKU "${finalSku}" ya existe en el inventario.`,
            variant: "destructive",
          });
          return;
        }
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

      if (mode === "add") {
        await addProduct({
          locationId: location.id,
          sku: finalSku,
          nombre: nombre.trim(),
          cantidad: cantidadNum,
          costo_proveedor: costoProveedorNum,
          precio_venta_sugerido: precioVentaSugeridoNum,
          caducidad: caducidadValue,
          stock_minimo: stockMinimoNum,
          stock_alto: stockAltoNum,
        });

        setLastAddedProduct({
          sku: finalSku,
          nombre: nombre.trim(),
          rack: location.rack,
          nivel: location.nivel,
          slot: location.slot,
          timestamp: new Date(),
          descripcion: product?.descripcion ?? null,
          cantidad: cantidadComercial,
          costoProveedor: costoProveedorComercialNum,
          precioVentaSugerido: precioVentaSugeridoNum,
          caducidad: caducidadValue,
        });

        setShowQRConfirmation(true);

        toast({
          title: "Producto agregado",
          description: `${nombre} se guardó con ${numeroComercial(
            cantidadComercial
          )} ${unidadActual.simbolo}.`,
        });

        onClose();
        return;
      }

      if (mode === "edit" && product) {
        await updateProduct(product.id, {
          sku: finalSku,
          nombre: nombre.trim(),
          cantidad: cantidadNum,
          costo_proveedor: costoProveedorNum,
          precio_venta_sugerido: precioVentaSugeridoNum,
          caducidad: caducidadValue,
          stock_minimo: stockMinimoNum,
          stock_alto: stockAltoNum,
        });

        toast({
          title: "Producto actualizado",
          description: `${nombre} actualizado en ${unidadActual.simbolo}.`,
        });

        onClose();
      }
    } catch (error) {
      console.error("Error guardando producto:", error);

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : mode === "add"
              ? "No se pudo guardar el producto."
              : "No se pudo actualizar el producto.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!product || isSelling || unidadLoading) return;

    const initialQuantity = Math.min(1, stockDisponibleComercial);

    setCantidadVendida(
      numeroComercial(
        initialQuantity > 0 ? initialQuantity : unidadActual.paso
      )
    );
    setPrecioVenta(
      Number(product.precio_venta_sugerido ?? 0).toString()
    );
    setSaleModalOpen(true);
  };

  const confirmSale = async () => {
    if (!product || isSelling || unidadLoading) return;

    const cantidadComercial = Number(cantidadVendida);
    const cantidadNum = cantidadInterna(cantidadComercial, unidadManejo);
    const precioComercial = Number(precioVenta);

    if (cantidadNum === null) {
      toast({
        title: "Cantidad inválida",
        description:
          unidadManejo === "pieza"
            ? "Captura piezas completas."
            : `Captura máximo 3 decimales en ${unidadActual.simbolo}.`,
        variant: "destructive",
      });
      return;
    }

    if (cantidadComercial > stockDisponibleComercial + 0.000001) {
      toast({
        title: "Cantidad inválida",
        description: `Disponible: ${numeroComercial(
          stockDisponibleComercial
        )} ${unidadActual.simbolo}.`,
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(precioComercial) || precioComercial < 0) {
      toast({
        title: "Precio inválido",
        description: "El precio de venta debe ser válido.",
        variant: "destructive",
      });
      return;
    }

    const precioInterno = precioComercial / factorInventario;

    try {
      setIsSelling(true);

      await deleteProduct(product.sku, {
        cantidad_vendida: cantidadNum,
        precio_venta: precioInterno,
      });

      toast({
        title: "Salida registrada",
        description: `${product.nombre}: ${numeroComercial(
          cantidadComercial
        )} ${unidadActual.simbolo} registrados como salida.`,
      });

      setSaleModalOpen(false);
      onClose();
    } catch (error) {
      console.error("Error registrando salida:", error);

      toast({
        title: "Error",
        description: "No se pudo registrar la salida.",
        variant: "destructive",
      });
    } finally {
      setIsSelling(false);
    }
  };

  const handleBuscarFisicamente = async () => {
    if (isSearchingPhysical) return;

    if (!location) {
      toast({
        title: "Ubicación no disponible",
        description: "No se encontró la ubicación del producto.",
        variant: "destructive",
      });

      return;
    }

    try {
      setIsSearchingPhysical(true);

      const result = await buscarFisicamente(location.id);

      toast({
        title: result.ok ? "Buscar físicamente" : "No se pudo buscar",
        description: result.mensaje,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error buscando físicamente:", error);

      toast({
        title: "Error",
        description: "No se pudo enviar el comando al rack.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingPhysical(false);
    }
  };

  return (
    <>
      <BlockingLoader
        show={isSaving}
        title={mode === "add" ? "Guardando producto" : "Actualizando producto"}
        description="Estamos enviando la información a la base de datos. No repitas la acción."
      />

      <BlockingLoader
        show={isSelling}
        title="Registrando salida"
        description="Estamos actualizando inventario, ventas y movimientos."
      />

      <BlockingLoader
        show={isSearchingPhysical}
        title="Buscando físicamente"
        description="Estamos enviando el comando al rack."
      />

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Agregar Producto" : "Editar Producto"}
            </DialogTitle>

            <DialogDescription>
              {location && (
                <>
                  Slot: {location.rack}-{location.nivel}-{location.slot}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="Ingrese el SKU"
                  required
                  disabled={isSaving || isSelling}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Producto</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ingrese el nombre"
                  required
                  disabled={isSaving || isSelling}
                />
              </div>

              <div className="space-y-2">
                <Label>Unidad de manejo</Label>
                <Select
                  value={unidadManejo}
                  onValueChange={(value) =>
                    setUnidadManejo(value as UnidadManejo)
                  }
                  disabled={
                    isSaving ||
                    isSelling ||
                    unidadLoading ||
                    (mode === "edit" && Number(product?.cantidad || 0) > 0)
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
                    ? "Consultando unidad..."
                    : mode === "edit" && Number(product?.cantidad || 0) > 0
                      ? "La unidad está bloqueada mientras exista inventario."
                      : unidadManejo === "pieza"
                        ? "Se administrará en piezas completas."
                        : `Se guardará internamente en ${unidadActual.unidadInterna}s.`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantidad">
                  Cantidad ({unidadActual.simbolo})
                </Label>
                <Input
                  id="cantidad"
                  type="number"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  placeholder={
                    unidadManejo === "pieza" ? "Ej: 100" : "Ej: 12.500"
                  }
                  min={unidadActual.paso}
                  step={unidadActual.paso}
                  required
                  disabled={isSaving || isSelling || unidadLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costoProveedor">
                  Costo proveedor por {unidadActual.simbolo}
                </Label>
                <Input
                  id="costoProveedor"
                  type="number"
                  value={costoProveedor}
                  onChange={(event) => setCostoProveedor(event.target.value)}
                  placeholder="Ej: 60.00"
                  min="0"
                  step="0.01"
                  required
                  disabled={isSaving || isSelling}
                />
                <p className="text-xs text-muted-foreground">
                  Costo real de compra por {unidadActual.simbolo}.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precioVentaSugerido">
                  Precio de venta por {unidadActual.simbolo}
                </Label>
                <Input
                  id="precioVentaSugerido"
                  type="number"
                  value={precioVentaSugerido}
                  onChange={(event) =>
                    setPrecioVentaSugerido(event.target.value)
                  }
                  placeholder="Ej: 120.00"
                  min="0"
                  step="0.01"
                  required
                  disabled={isSaving || isSelling}
                />
                <p className="text-xs text-muted-foreground">
                  Se cargará automáticamente al registrar salida, pero se podrá
                  modificar manualmente.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Caducidad</Label>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={caducidadNoAplica}
                      disabled={isSaving || isSelling}
                      onChange={(event) => {
                        setCaducidadNoAplica(event.target.checked);

                        if (event.target.checked) {
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
                  disabled={caducidadNoAplica || isSaving || isSelling}
                  placeholder="dd/mm/aaaa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockMinimo">
                  Stock crítico ({unidadActual.simbolo})
                </Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  value={stockMinimo}
                  onChange={(event) => setStockMinimo(event.target.value)}
                  placeholder="Opcional. Por defecto: 10"
                  min={unidadActual.paso}
                  step={unidadActual.paso}
                  disabled={isSaving || isSelling || unidadLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío, el sistema usará 10. El producto será
                  crítico cuando la cantidad sea menor a este valor.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockAlto">
                  Stock alto ({unidadActual.simbolo})
                </Label>
                <Input
                  id="stockAlto"
                  type="number"
                  value={stockAlto}
                  onChange={(event) => setStockAlto(event.target.value)}
                  placeholder="Opcional. Por defecto: stock crítico x 3"
                  min={unidadActual.paso}
                  step={unidadActual.paso}
                  disabled={isSaving || isSelling || unidadLoading}
                />
                <p className="text-xs text-muted-foreground">
                  El producto se marcará como stock alto cuando la cantidad sea
                  mayor o igual a este valor.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                {mode === "edit" && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSaving || isSelling}
                  >
                    {isSelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Eliminar / Salida"
                    )}
                  </Button>
                )}

                {product && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBuscarFisicamente}
                    disabled={isSearchingPhysical || isSaving || isSelling}
                  >
                    {isSearchingPhysical ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <LocateFixed className="mr-2 h-4 w-4" />
                        Buscar físicamente
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSaving || isSelling}
                >
                  Cancelar
                </Button>

                <Button type="submit" disabled={isSaving || isSelling}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : mode === "add" ? (
                    "Agregar"
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar salida / venta</DialogTitle>
            <DialogDescription>
              Indica cuántos {unidadActual.simbolo} vas a retirar y el
              precio de venta por {unidadActual.simbolo}.
            </DialogDescription>
          </DialogHeader>

          {product && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-semibold">{product.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  SKU: {product.sku}
                </p>
                <p className="text-sm text-muted-foreground">
                  Disponible: {numeroComercial(
                    stockDisponibleComercial
                  )}{" "}
                  {unidadActual.simbolo}
                </p>
                <p className="text-sm text-muted-foreground">
                  Costo proveedor por {unidadActual.simbolo}:{" "}
                  {formatMoney(costoProveedorComercial)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Precio por {unidadActual.simbolo}:{" "}
                  {formatMoney(Number(product.precio_venta_sugerido ?? 0))}
                </p>
              </div>

              {productoVencido && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-semibold">Producto vencido</p>
                      <p className="text-sm">
                        Este producto venció hace{" "}
                        {Math.abs(diasCaducidad ?? 0)} día(s). No se recomienda
                        aplicar descuento. La acción sugerida es
                        retirar/eliminar del inventario y registrar merma.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cantidadVendida">
                  Cantidad a retirar ({unidadActual.simbolo})
                </Label>
                <Input
                  id="cantidadVendida"
                  type="number"
                  min={unidadActual.paso}
                  max={stockDisponibleComercial}
                  step={unidadActual.paso}
                  value={cantidadVendida}
                  onChange={(event) => setCantidadVendida(event.target.value)}
                  disabled={isSelling}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="precioVenta">
                  Precio de venta por {unidadActual.simbolo}
                </Label>
                <Input
                  id="precioVenta"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioVenta}
                  onChange={(event) => setPrecioVenta(event.target.value)}
                  placeholder="Ej: 120.00"
                  disabled={isSelling}
                />
                <p className="text-xs text-muted-foreground">
                  Puedes dejar el precio sugerido o modificarlo manualmente.
                </p>
              </div>

              {productoTieneDescuento && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <Percent className="mt-0.5 h-5 w-5" />

                    <div className="space-y-2">
                      <p className="font-semibold">
                        Sugerencia de descuento por caducidad
                      </p>

                      <p className="text-sm">
                        Caduca en {diasCaducidad} día(s). Descuento sugerido:{" "}
                        {descuentoSugerido}%.
                      </p>

                      <p className="text-sm">
                        Precio con descuento:{" "}
                        {formatMoney(precioConDescuento)}
                      </p>

                      <p className="text-sm">
                        Recuperación estimada:{" "}
                        {formatMoney(recuperacionConDescuento)}
                      </p>

                      <p className="text-sm">
                        Resultado estimado:{" "}
                        <span
                          className={
                            resultadoConDescuento >= 0
                              ? "font-semibold text-green-700"
                              : "font-semibold text-red-700"
                          }
                        >
                          {resultadoConDescuento >= 0 ? "+" : "-"}
                          {formatMoney(Math.abs(resultadoConDescuento))}
                        </span>
                      </p>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSelling}
                        onClick={() =>
                          setPrecioVenta(precioConDescuento.toFixed(2))
                        }
                      >
                        Usar precio con descuento
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-sm">
                  Ingreso estimado:{" "}
                  <strong>{formatMoney(ingresoEstimado)}</strong>
                </p>

                <p className="text-sm">
                  Costo estimado:{" "}
                  <strong>{formatMoney(costoSalidaEstimado)}</strong>
                </p>

                <p className="text-sm">
                  Ganancia estimada:{" "}
                  <span
                    className={
                      gananciaEstimada >= 0
                        ? "font-semibold text-green-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {gananciaEstimada >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(gananciaEstimada))}
                  </span>
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaleModalOpen(false)}
              disabled={isSelling}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={confirmSale}
              disabled={isSelling}
            >
              {isSelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Confirmar salida"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QRConfirmationModal
        isOpen={showQRConfirmation}
        onClose={() => setShowQRConfirmation(false)}
        productData={lastAddedProduct}
      />
    </>
  );
}
