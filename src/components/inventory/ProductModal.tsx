//modificacion inicia
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventory } from "@/context/InventoryContext";
import { Location, Product } from "@/types/inventory";
import { useToast } from "@/hooks/use-toast";
import { QRConfirmationModal } from "./QRConfirmationModal";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  product: Product | null;
  mode: "add" | "edit";
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

  const { addProduct, updateProduct, deleteProduct, products } = useInventory();

  const { toast } = useToast();

  // 🧩 Llenar campos si está en modo edición
  useEffect(() => {
    if (mode === "edit" && product) {
      setSku(product.sku);
      setNombre(product.nombre);
      setCantidad(product.cantidad.toString());
      setCostoProveedor(product.costo_proveedor?.toString() ?? "0");
    } else {
      setSku("");
      setNombre("");
      setCantidad("");
      setCostoProveedor("");
    }
  }, [mode, product, isOpen]);

  // ✅ Guardar producto (agregar o editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

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

    // 🟩 AGREGAR
    // 🟩 AGREGAR
    if (mode === "add") {
      // 🔍 Validar SKU duplicado
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
          description: `${nombre} se guardó correctamente`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo guardar el producto.",
          variant: "destructive",
        });
      }
    }

    // 🟨 EDITAR
    else if (mode === "edit" && product) {
      try {
        updateProduct(product.id, {
          sku,
          nombre,
          cantidad: cantidadNum,
          costo_proveedor: costoProveedorNum,
        });
        toast({
          title: "Producto actualizado",
          description: `${nombre} actualizado exitosamente`,
        });
      } catch (error) {
        console.error("❌ Error actualizando producto:", error);
        toast({
          title: "Error",
          description: "No se pudo actualizar el producto.",
          variant: "destructive",
        });
      }
    }

    onClose();
  };

  // 🗑️ Eliminar producto (llama a backend)
  const handleDelete = () => {
  if (!product) return;
  setCantidadVendida("1");
  setPrecioVenta("");
  setSaleModalOpen(true);
};

  const confirmSale = async () => {
  if (!product) return;

  const cantidad = Number(cantidadVendida);
  const precio = Number(precioVenta);

  if (!cantidad || cantidad <= 0) {
    toast({
      title: "Cantidad inválida",
      description: "La cantidad a eliminar debe ser mayor a 0.",
      variant: "destructive",
    });
    return;
  }

  if (cantidad > product.cantidad) {
    toast({
      title: "Cantidad inválida",
      description: "No puedes eliminar más piezas de las existentes.",
      variant: "destructive",
    });
    return;
  }

  if (isNaN(precio) || precio < 0) {
    toast({
      title: "Precio inválido",
      description: "El precio de venta debe ser válido.",
      variant: "destructive",
    });
    return;
  }

  try {
    await deleteProduct(product.sku, {
      cantidad_vendida: cantidad,
      precio_venta: precio,
    });

    toast({
      title: "Salida registrada",
      description: `${product.nombre}: ${cantidad} pieza(s) registradas como salida.`,
    });

    setSaleModalOpen(false);
    onClose();
  } catch (error) {
    console.error("❌ Error registrando salida:", error);
    toast({
      title: "Error",
      description: "No se pudo registrar la salida.",
      variant: "destructive",
    });
  }
};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Agregar Producto" : "Editar Producto"}
          </DialogTitle>
        </DialogHeader>

        {location && (
          <div className="text-sm text-muted-foreground mb-4">
            Slot: {location.rack}-{location.nivel}-{location.slot}
          </div>
        )}

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
          </div>
          

          <DialogFooter className="flex gap-2">
            {mode === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                Eliminar
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

      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Registrar salida / venta</DialogTitle>
      <DialogDescription>
        Indica cuántas piezas vas a eliminar y el precio de venta unitario.
      </DialogDescription>
    </DialogHeader>

    {product && (
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="font-semibold">{product.nombre}</p>
          <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
          <p className="text-sm text-muted-foreground">
            Disponible: {product.cantidad}
          </p>
          <p className="text-sm text-muted-foreground">
            Costo proveedor unitario: $
            {Number(product.costo_proveedor ?? 0).toFixed(2)}
          </p>
        </div>

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
        </div>

        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
          <p>
            Ingreso estimado: $
            {(Number(precioVenta || 0) * Number(cantidadVendida || 0)).toFixed(
              2
            )}
          </p>
          <p>
            Costo estimado: $
            {(
              Number(product.costo_proveedor ?? 0) *
              Number(cantidadVendida || 0)
            ).toFixed(2)}
          </p>
          <p className="font-semibold">
            Ganancia estimada: $
            {(
              Number(precioVenta || 0) * Number(cantidadVendida || 0) -
              Number(product.costo_proveedor ?? 0) *
                Number(cantidadVendida || 0)
            ).toFixed(2)}
          </p>
        </div>
      </div>
    )}

    <DialogFooter>
      <Button variant="outline" onClick={() => setSaleModalOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={confirmSale}>Confirmar salida</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* 🔳 Confirmación QR */}
      <QRConfirmationModal
        isOpen={showQRConfirmation}
        onClose={() => setShowQRConfirmation(false)}
        productData={lastAddedProduct}
      />
    </Dialog>
  );
}
//modificacion cierra
