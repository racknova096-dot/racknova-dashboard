import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { PageHero } from "@/components/layout/PageHero";

export default function AddProduct() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Alta y restock de inventario"
        title="Agregar Producto"
        description="Registra productos nuevos, reabastece productos existentes y controla caducidad, costos, ubicación y stock crítico."
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
            label: "Ubicación",
            value: "Rack / Nivel / Slot",
            tone: "purple",
          },
          {
            label: "Costos",
            value: "Promedio",
            tone: "amber",
          },
        ]}
      >
        Si el producto ya existe, RackNova lo detecta como restock y conserva su
        ubicación. Si es nuevo, se registra en inventario y catálogo.
      </PageHero>

      <InventoryForm />
    </div>
  );
}
