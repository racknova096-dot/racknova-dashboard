import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config";
import { ProductoCatalogo } from "@/types/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  Lock,
} from "lucide-react";

export default function Catalogo() {
  const [items, setItems] = useState<ProductoCatalogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");

  const { toast } = useToast();

  const loadCatalog = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/catalogo/productos`);

      if (!response.ok) {
        throw new Error("No se pudo cargar el catálogo.");
      }

      const data = await response.json();

      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "No se pudo cargar el catálogo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return items;

    return items.filter((item) => {
      return (
        item.sku?.toLowerCase().includes(term) ||
        item.nombre?.toLowerCase().includes(term) ||
        item.descripcion?.toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  const clearForm = () => {
    setSku("");
    setNombre("");
    setDescripcion("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const skuClean = sku.trim();
    const nombreClean = nombre.trim();
    const descripcionClean = descripcion.trim();

    if (!skuClean || !nombreClean) {
      toast({
        title: "Campos incompletos",
        description: "El SKU y el nombre son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/catalogo/productos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: skuClean,
          nombre: nombreClean,
          descripcion: descripcionClean || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(errorText);

        throw new Error("No se pudo crear el registro.");
      }

      toast({
        title: "Registro agregado",
        description: `${nombreClean} fue agregado al catálogo.`,
      });

      clearForm();
      await loadCatalog();
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "No se pudo agregar el registro al catálogo.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (item: ProductoCatalogo) => {
    setEditingSku(item.sku);
    setEditNombre(item.nombre ?? "");
    setEditDescripcion(item.descripcion ?? "");
  };

  const cancelEdit = () => {
    setEditingSku(null);
    setEditNombre("");
    setEditDescripcion("");
  };

  const handleUpdate = async (item: ProductoCatalogo) => {
    if (!editingSku) return;

    const nombreClean = editNombre.trim();
    const descripcionClean = editDescripcion.trim();

    if (!nombreClean) {
      toast({
        title: "Nombre obligatorio",
        description: "El nombre no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/catalogo/productos/${encodeURIComponent(item.sku)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sku: item.sku,
            nombre: nombreClean,
            descripcion: descripcionClean || null,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(errorText);

        throw new Error("No se pudo actualizar el registro.");
      }

      toast({
        title: "Registro actualizado",
        description: "El catálogo fue actualizado correctamente.",
      });

      cancelEdit();
      await loadCatalog();
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "No se pudo actualizar el registro.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (item: ProductoCatalogo) => {
    const confirmed = window.confirm(
      `¿Eliminar del catálogo el producto "${item.nombre}"?\n\nEsta acción no elimina movimientos históricos.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/catalogo/productos/${encodeURIComponent(item.sku)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(errorText);

        toast({
          title: "No se pudo eliminar",
          description:
            "Si el producto existe actualmente en inventario, primero debe retirarse o venderse.",
          variant: "destructive",
        });

        return;
      }

      toast({
        title: "Registro eliminado",
        description: "El producto fue eliminado del catálogo.",
      });

      await loadCatalog();
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "No se pudo eliminar el registro.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="p-6 space-y-6">
        <div>
          <h1 className="racknova-page-title flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Catálogo
          </h1>
          <p className="text-muted-foreground">
            Administra la identidad histórica de productos: SKU, nombre y
            descripción.
          </p>
        </div>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Agregar registro al catálogo
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej: COCA600"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Coca Cola 600 ml"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción del producto..."
                  rows={3}
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={clearForm}>
                  Limpiar
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <span>Registros del catálogo</span>
              <span className="text-sm font-normal text-muted-foreground">
                {filteredItems.length} registro(s)
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por SKU, nombre o descripción..."
                className="pl-9"
              />
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">
                Cargando catálogo...
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay registros en catálogo.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="racknova-table-header">
                    <tr>
                      <th className="text-left p-3">SKU</th>
                      <th className="text-left p-3">Nombre</th>
                      <th className="text-left p-3">Descripción</th>
                      <th className="text-right p-3">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredItems.map((item) => {
                      const isEditing = editingSku === item.sku;

                      return (
                        <tr key={item.sku} className="border-t">
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-2 font-mono">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                              {item.sku}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              El SKU no se puede editar.
                            </p>
                          </td>

                          <td className="p-3 align-top min-w-[220px]">
                            {isEditing ? (
                              <Input
                                value={editNombre}
                                onChange={(e) =>
                                  setEditNombre(e.target.value)
                                }
                              />
                            ) : (
                              <span className="font-medium">
                                {item.nombre}
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top min-w-[320px]">
                            {isEditing ? (
                              <Textarea
                                value={editDescripcion}
                                onChange={(e) =>
                                  setEditDescripcion(e.target.value)
                                }
                                rows={2}
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {item.descripcion || "Sin descripción"}
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdate(item)}
                                  >
                                    <Save className="h-4 w-4 mr-1" />
                                    Guardar
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEdit(item)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(item)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Eliminar
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
