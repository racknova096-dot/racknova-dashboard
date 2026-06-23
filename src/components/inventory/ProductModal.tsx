//modificacion inicia
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  const handleDelete = async () => {
    if (!product) return;

    try {
      await deleteProduct(product.sku);
      toast({
        title: "Producto eliminado",
        description: `${product.nombre} eliminado correctamente.`,
      });
      onClose();
    } catch (error) {
      console.error("❌ Error eliminando producto:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto en el servidor.",
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
