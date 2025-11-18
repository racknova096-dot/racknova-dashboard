import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { ArrowLeft, Package } from 'lucide-react';

export default function AddProduct() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Agregar Producto</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <InventoryForm />
    </div>
  );
}