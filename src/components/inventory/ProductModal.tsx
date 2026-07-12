import React, { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, Percent, LocateFixed } from "lucide-react";

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

  // Producto vencido: no se sugiere descuento.
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
  const [lastAddedProduct, setLastAddedProduct] = useState<{
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location) return;

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
    description: "El stock alto debe ser mayor al stock crítico.",
    variant: "destructive",
  });
  return;
}

    const caducidadValue = caducidadNoAplica || !caducidad ? null : caducidad;

    if (mode === "add") {
      const skuDuplicado = products.some(
        (p) => p.sku.toLowerCase() === sku.toLowerCase()
      );

      if (skuDuplicado) {
        toast({
          title: "SKU duplicado",
          description: `El SKU "${sku}" ya existe en el inventario.`,
          variant: "destructive",
        });

        return;
      }

      try {
        await addProduct({
  locationId: location.id,
  sku,
  nombre,
  cantidad: cantidadNum,
  costo_proveedor: costoProveedorNum,
  precio_venta_sugerido: precioVentaSugeridoNum,
  caducidad: caducidadValue,
  stock_minimo: stockMinimoNum,
  stock_alto: stockAltoNum,
});

        setLastAddedProduct({
          sku,
          nombre,
          rack: location.rack,
          nivel: location.nivel,
          slot: location.slot,
          timestamp: new Date(),
        });

        setShowQRConfirmation(true);

        toast({
          title: "Producto agregado",
          description: `${nombre} se guardó correctamente.`,
        });
      } catch (error) {
        console.error("Error guardando producto:", error);

        toast({
          title: "Error",
          description: "No se pudo guardar el producto.",
          variant: "destructive",
        });

        return;
      }
    }

    if (mode === "edit" && product) {
      try {
        await updateProduct(product.id, {
          sku,
          nombre,
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
      } catch (error) {
        console.error("Error actualizando producto:", error);

        toast({
          title: "Error",
          description: "No se pudo actualizar el producto.",
          variant: "destructive",
        });

        return;
      }
    }

    onClose();
  };

  const handleDelete = () => {
    if (!product) return;

    setCantidadVendida("1");
    setPrecioVenta(Number(product.precio_venta_sugerido ?? 0).toString());
    setSaleModalOpen(true);
  };

  const confirmSale = async () => {
    if (!product) return;

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
    }
  };
const handleBuscarFisicamente = async () => {
  if (!location) {
    toast({
      title: "Ubicación no disponible",
      description: "No se encontró la ubicación del producto.",
      variant: "destructive",
    });
    return;
  }

  const result = await buscarFisicamente(location.id);

  toast({
    title: result.ok ? "Buscar físicamente" : "No se pudo buscar",
    description: result.mensaje,
    variant: result.ok ? "default" : "destructive",
  });
};
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Agregar Producto" : "Editar Producto"}
            </DialogTitle>

            {location && (
              <DialogDescription>
                Slot: {location.rack}-{location.nivel}-{location.slot}
              </DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>

              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ingrese el SKU"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Producto</Label>

              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ingrese el nombre"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad</Label>

              <Input
                id="cantidad"
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ingrese la cantidad"
                min="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="costoProveedor">Costo proveedor unitario</Label>

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
                Precio de venta sugerido
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
                Se cargará automáticamente al registrar salida, pero se podrá
                modificar manualmente.
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
              <Label htmlFor="stockMinimo">Stock crítico personalizado</Label>

              <Input
                id="stockMinimo"
                type="number"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="Opcional. Por defecto: 10"
                min="1"
              />

              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío, el sistema usará 10. El producto será crítico
                cuando la cantidad sea menor a este valor.
              </p>
            </div>

            <div className="space-y-2">
  <Label>Stock alto personalizado</Label>
  <Input
    type="number"
    value={stockAlto}
    onChange={(e) => setStockAlto(e.target.value)}
    placeholder="Opcional. Por defecto: stock crítico x 3"
    min="1"
  />
  <p className="text-xs text-muted-foreground">
    El producto se marcará como stock alto cuando la cantidad sea mayor o igual
    a este valor.
  </p>
</div>

            <DialogFooter className="gap-2">
              {mode === "edit" && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Eliminar / Salida
                </Button>
              )}

              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>

              <Button type="submit">
                {mode === "add" ? "Agregar" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar salida / venta</DialogTitle>

            <DialogDescription>
              Indica cuántas piezas vas a eliminar y el precio de venta
              unitario.
            </DialogDescription>
          </DialogHeader>

          {product && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted p-3 text-sm space-y-1">
                <p className="font-semibold">{product.nombre}</p>
                <p>SKU: {product.sku}</p>
                <p>Disponible: {product.cantidad}</p>
                <p>
                  Costo proveedor unitario:{" "}
                  {formatMoney(Number(product.costo_proveedor ?? 0))}
                </p>
                <p>
                  Precio venta sugerido:{" "}
                  {formatMoney(Number(product.precio_venta_sugerido ?? 0))}
                </p>
              </div>

              {productoVencido && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-red-800">
                    <AlertTriangle className="h-4 w-4" />
                    Producto vencido
                  </div>

                  <p className="text-red-800">
                    Este producto venció hace{" "}
                    <strong>{Math.abs(diasCaducidad ?? 0)} día(s)</strong>.
                    No se recomienda aplicar descuento. La acción sugerida es
                    retirar/eliminar del inventario y registrar merma.
                  </p>
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
                  onChange={(e) => setCantidadVendida(e.target.value)}
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
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  placeholder="Ej: 120.00"
                />

                <p className="text-xs text-muted-foreground">
                  Puedes dejar el precio sugerido o modificarlo manualmente.
                </p>
              </div>

              {productoTieneDescuento && (
                <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-orange-800">
                    <Percent className="h-4 w-4" />
                    Sugerencia de descuento por caducidad
                  </div>

                  <p className="text-orange-800">
                    Caduca en <strong>{diasCaducidad}</strong> día(s).
                    Descuento sugerido:{" "}
                    <strong>{descuentoSugerido}%</strong>.
                  </p>

                  <p>
                    Precio con descuento:{" "}
                    <strong>{formatMoney(precioConDescuento)}</strong>
                  </p>

                  <p>
                    Recuperación estimada:{" "}
                    <strong>{formatMoney(recuperacionConDescuento)}</strong>
                  </p>

                  <p>
                    Resultado estimado:{" "}
                    <strong
                      className={
                        resultadoConDescuento >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }
                    >
                      {resultadoConDescuento >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(resultadoConDescuento))}
                    </strong>
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPrecioVenta(precioConDescuento.toFixed(2))}
                  >
                    Usar precio con descuento
                  </Button>
                </div>
              )}

              <div className="rounded-md border bg-muted p-3 text-sm space-y-1">
                <p>
                  Ingreso estimado:{" "}
                  <strong>{formatMoney(ingresoEstimado)}</strong>
                </p>

                <p>
                  Costo estimado:{" "}
                  <strong>{formatMoney(costoSalidaEstimado)}</strong>
                </p>

                <p>
                  Ganancia estimada:{" "}
                  <strong
                    className={
                      gananciaEstimada >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }
                  >
                    {gananciaEstimada >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(gananciaEstimada))}
                  </strong>
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaleModalOpen(false)}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={confirmSale}>
              Confirmar salida
            </Button>
          </DialogFooter>
          {product && (
  <Button
    type="button"
    variant="outline"
    onClick={handleBuscarFisicamente}
  >
    <LocateFixed className="h-4 w-4 mr-2" />
    Buscar físicamente
  </Button>
)}
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
