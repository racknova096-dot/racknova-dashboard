import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ProveedorEntradaCard } from "@/components/compras/ProveedorEntradaCard";
import { ProductoImagenEntradaCard } from "@/components/catalog/ProductoImagenEntradaCard";
import { PageHero } from "@/components/layout/PageHero";

export default function AddProduct() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Alta y restock de inventario"
        title="Agregar Producto"
        description="Registra entradas, proveedor, imagen, costo, ubicación y stock objetivo en un solo flujo."
        icon={PackagePlus}
        actions={
          <Button variant="secondary" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        }
        stats={[
          {
            label: "Modo",
            value: "Ingreso",
            tone: "green",
          },
          {
            label: "Control",
            value: "FEFO",
            tone: "blue",
          },
          {
            label: "Proveedor",
            value: "Trazable",
            tone: "purple",
          },
          {
            label: "Imagen",
            value: "Por SKU",
            tone: "amber",
          },
        ]}
      >
        Selecciona quién surtió la entrada y, si el artículo es nuevo, puedes
        agregar su imagen. Si ese SKU ya tiene foto en catálogo, RackNova reutiliza
        automáticamente la misma.
      </PageHero>

      <ProveedorEntradaCard />
      <ProductoImagenEntradaCard />
      <InventoryForm />
    </div>
  );
}
