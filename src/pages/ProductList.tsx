import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInventory } from "@/context/InventoryContext";
import { ProductModal } from "@/components/inventory/ProductModal";
import { Product, Location, Rack, Nivel } from "@/types/inventory";
import { Pencil, Trash2, Search, Filter, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { API_URL } from "../config";

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRack, setFilterRack] = useState<string>("all");
  const [filterNivel, setFilterNivel] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );

  // 👉 UNA sola llamada a useInventory()
  const { products, locations, deleteProduct } = useInventory();
  const { toast } = useToast();

  const productsWithLocation = products.map((p) => ({
    ...p,
    location: locations.find((l) => l.id === p.locationId)!,
  }));

  const filteredProducts = productsWithLocation.filter((product) => {
    const matchesSearch =
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRack =
      filterRack === "all" || product.location.rack === filterRack;
    const matchesNivel =
      filterNivel === "all" ||
      product.location.nivel.toString() === filterNivel;

    return matchesSearch && matchesRack && matchesNivel;
  });

  const handleEdit = (product: Product) => {
    const location = locations.find((loc) => loc.id === product.locationId);
    setSelectedProduct(product);
    setSelectedLocation(location || null);
    setModalOpen(true);
  };

  const handleDelete = (product: Product) => {
    deleteProduct(product.sku);
    toast({
      title: "Producto eliminado",
      description: `${product.nombre} eliminado exitosamente`,
    });
  };
  const handleUpdate = async (updatedProduct: Product) => {
    try {
      const response = await fetch(
        `${API_URL}/productos/${updatedProduct.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedProduct),
        }
      );

      if (!response.ok) throw new Error("Error al actualizar el producto");

      toast({
        title: "Producto actualizado",
        description: `${updatedProduct.nombre} fue actualizado correctamente.`,
      });
    } catch (error) {
      console.error("❌ Error al actualizar:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto en el servidor.",
        variant: "destructive",
      });
    }
  };

  const getStockBadge = (cantidad: number) => {
    if (cantidad <= 5)
      return <Badge variant="destructive">Stock Crítico</Badge>;
    if (cantidad <= 10) return <Badge variant="secondary">Stock Bajo</Badge>;
    return (
      <Badge
        variant="default"
        className="bg-slot-free text-slot-free-foreground"
      >
        Stock Normal
      </Badge>
    );
  };

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
          <h1 className="text-3xl font-bold text-foreground">
            Listado de Productos
          </h1>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por SKU o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterRack} onValueChange={setFilterRack}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Rack" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Racks</SelectItem>
                <SelectItem value="A">Rack A</SelectItem>
                <SelectItem value="B">Rack B</SelectItem>
                <SelectItem value="C">Rack C</SelectItem>
                <SelectItem value="D">Rack D</SelectItem>
                <SelectItem value="E">Rack E</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterNivel} onValueChange={setFilterNivel}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Niveles</SelectItem>
                <SelectItem value="1">Nivel 1</SelectItem>
                <SelectItem value="2">Nivel 2</SelectItem>
                <SelectItem value="3">Nivel 3</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilterRack("all");
                setFilterNivel("all");
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Productos ({filteredProducts.length} de{" "}
            {productsWithLocation.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rack</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.location.rack}
                      </TableCell>
                      <TableCell>{product.location.nivel}</TableCell>
                      <TableCell>{product.location.slot}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.nombre}</TableCell>
                      <TableCell className="font-medium">
                        {product.cantidad}
                      </TableCell>
                      <TableCell>{getStockBadge(product.cantidad)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Product Modal */}
      {selectedProduct && selectedLocation && (
        <ProductModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedProduct(null);
            setSelectedLocation(null);
          }}
          location={selectedLocation}
          product={selectedProduct}
          mode="edit"
        />
      )}
    </div>
  );
}
