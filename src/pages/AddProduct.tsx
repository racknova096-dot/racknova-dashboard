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
        description="Registra entradas, crea una ubicación física libre para productos nuevos y guía cada reabastecimiento hacia el mismo lugar."
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
            value: "Libre · RNLOC",
            tone: "purple",
          },
          {
            label: "Costos",
            value: "Promedio",
            tone: "amber",
          },
        ]}
      >
        Si el producto es nuevo, RackNova genera una etiqueta para el lugar
        físico que tú elijas. En entradas futuras puede pedirte escanear esa misma
        etiqueta antes de confirmar el acomodo.
      </PageHero>

      <InventoryForm />
    </div>
  );
}
