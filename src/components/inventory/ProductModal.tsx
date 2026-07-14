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

  useEffect(() => {
    if (mode === "edit" && product) {
      setSku(product.sku);
      setNombre(product.nombre);
      setCantidad(product.cantidad.toString());
      setCostoProveedor(product.costo_proveedor?.toString() ?? "0");
      setPrecioVentaSugerido(
        product.precio_venta_sugerido?.toString() ?? "0"
      );
      setCaducidad(product.caducidad ? product.caducidad.slice(0, 10) : "");
      setCaducidadNoAplica(!product.caducidad);
      setStockMinimo(product.stock_minimo?.toString() ?? "");
      setStockAlto(product.stock_alto?.toString() ?? "");
    } else {
      setSku("");
      setNombre("");
      setCantidad("");
      setCostoProveedor("");
      setPrecioVentaSugerido("");
      setCaducidad("");
      setCaducidadNoAplica(true);
      setStockMinimo("");
      setStockAlto("");
    }
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
    Number(product?.costo_proveedor ?? 0) * cantidadSalidaNum;
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

    const cantidadNum = parseInt(cantidad);

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser un número positivo.",
        variant: "destructive",
      });

      return false;
    }

    const costoProveedorNum = parseFloat(costoProveedor);

    if (isNaN(costoProveedorNum) || costoProveedorNum < 0) {
      toast({
        title: "Error",
        description: "El costo proveedor debe ser un número válido.",
        variant: "destructive",
      });

      return false;
    }

    const precioVentaSugeridoNum = parseFloat(precioVentaSugerido);

    if (isNaN(precioVentaSugeridoNum) || precioVentaSugeridoNum < 0) {
      toast({
        title: "Error",
        description: "El precio de venta sugerido debe ser un número válido.",
        variant: "destructive",
      });

      return false;
    }

    const stockMinimoNum =
      stockMinimo.trim() === "" ? 10 : parseInt(stockMinimo);

    if (isNaN(stockMinimoNum) || stockMinimoNum <= 0) {
      toast({
        title: "Error",
        description: "El stock crítico debe ser un número mayor a 0.",
        variant: "destructive",
      });

      return false;
    }

    const stockAltoNum =
      stockAlto.trim() === "" ? stockMinimoNum * 3 : parseInt(stockAlto);

    if (isNaN(stockAltoNum) || stockAltoNum <= stockMinimoNum) {
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

    if (isSaving) return;
    if (!validateBaseFields()) return;
    if (!location) return;

    const cantidadNum = parseInt(cantidad);
    const costoProveedorNum = parseFloat(costoProveedor);
    const precioVentaSugeridoNum = parseFloat(precioVentaSugerido);

    const stockMinimoNum =
      stockMinimo.trim() === "" ? 10 : parseInt(stockMinimo);

    const stockAltoNum =
      stockAlto.trim() === "" ? stockMinimoNum * 3 : parseInt(stockAlto);

    const caducidadValue =
      caducidadNoAplica || !caducidad ? null : caducidad;

    try {
      setIsSaving(true);

      if (mode === "add") {
        const skuDuplicado = products.some(
          (item) => item.sku.toLowerCase() === sku.trim().toLowerCase()
        );

        if (skuDuplicado) {
          toast({
            title: "SKU duplicado",
            description: `El SKU "${sku}" ya existe en el inventario.`,
            variant: "destructive",
          });

          return;
        }

        await addProduct({
          locationId: location.id,
          sku: sku.trim(),
          nombre: nombre.trim(),
          cantidad: cantidadNum,
          costo_proveedor: costoProveedorNum,
          precio_venta_sugerido: precioVentaSugeridoNum,
          caducidad: caducidadValue,
          stock_minimo: stockMinimoNum,
          stock_alto: stockAltoNum,
        });

        setLastAddedProduct({
          sku: sku.trim(),
          nombre: nombre.trim(),
          rack: location.rack,
          nivel: location.nivel,
          slot: location.slot,
          timestamp: new Date(),
          descripcion: product?.descripcion ?? null,
          cantidad: cantidadNum,
          costoProveedor: costoProveedorNum,
          precioVentaSugerido: precioVentaSugeridoNum,
          caducidad: caducidadValue,
        });

        setShowQRConfirmation(true);

        toast({
          title: "Producto agregado",
          description: `${nombre} se guardó correctamente.`,
        });

        onClose();
        return;
      }

      if (mode === "edit" && product) {
        await updateProduct(product.id, {
          sku: sku.trim(),
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
          description: `${nombre} actualizado exitosamente.`,
        });

        onClose();
      }
    } catch (error) {
      console.error("Error guardando producto:", error);

      toast({
        title: "Error",
        description:
          mode === "add"
            ? "No se pudo guardar el producto."
            : "No se pudo actualizar el producto.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!product || isSelling) return;

    setCantidadVendida("1");
    setPrecioVenta(Number(product.precio_venta_sugerido ?? 0).toString());
    setSaleModalOpen(true);
  };

  const confirmSale = async () => {
    if (!product || isSelling) return;

    const cantidadNum = Number(cantidadVendida);
    const precioNum = Number(precioVenta);

    if (!cantidadNum || cantidadNum <= 0) {
      toast({
        title: "Cantidad inválida",
        description: "La cantidad a eliminar debe ser mayor a 0.",
        variant: "destructive",
      });

      return;
    }

    if (cantidadNum > product.cantidad) {
      toast({
        title: "Cantidad inválida",
        description: "No puedes eliminar más piezas de las existentes.",
        variant: "destructive",
      });

      return;
    }

    if (isNaN(precioNum) || precioNum < 0) {
      toast({
        title: "Precio inválido",
        description: "El precio de venta debe ser válido.",
        variant: "destructive",
      });

      return;
    }

    try {
      setIsSelling(true);

      await deleteProduct(product.sku, {
        cantidad_vendida: cantidadNum,
        precio_venta: precioNum,
      });

      toast({
        title: "Salida registrada",
        description: `${product.nombre}: ${cantidadNum} pieza(s) registradas como salida.`,
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
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  placeholder="Ingrese la cantidad"
                  min="1"
                  required
                  disabled={isSaving || isSelling}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costoProveedor">Costo proveedor unitario</Label>
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
                  Costo real de compra por unidad.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precioVentaSugerido">
                  Precio de venta sugerido
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
                <Label htmlFor="stockMinimo">Stock crítico personalizado</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  value={stockMinimo}
                  onChange={(event) => setStockMinimo(event.target.value)}
                  placeholder="Opcional. Por defecto: 10"
                  min="1"
                  disabled={isSaving || isSelling}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío, el sistema usará 10. El producto será
                  crítico cuando la cantidad sea menor a este valor.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockAlto">Stock alto personalizado</Label>
                <Input
                  id="stockAlto"
                  type="number"
                  value={stockAlto}
                  onChange={(event) => setStockAlto(event.target.value)}
                  placeholder="Opcional. Por defecto: stock crítico x 3"
                  min="1"
                  disabled={isSaving || isSelling}
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
              Indica cuántas piezas vas a eliminar y el precio de venta
              unitario.
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
                  Disponible: {product.cantidad}
                </p>
                <p className="text-sm text-muted-foreground">
                  Costo proveedor unitario:{" "}
                  {formatMoney(Number(product.costo_proveedor ?? 0))}
                </p>
                <p className="text-sm text-muted-foreground">
                  Precio venta sugerido:{" "}
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
                <Label htmlFor="cantidadVendida">Cantidad a eliminar</Label>
                <Input
                  id="cantidadVendida"
                  type="number"
                  min="1"
                  max={product.cantidad}
                  value={cantidadVendida}
                  onChange={(event) => setCantidadVendida(event.target.value)}
                  disabled={isSelling}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="precioVenta">Precio venta unitario</Label>
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
