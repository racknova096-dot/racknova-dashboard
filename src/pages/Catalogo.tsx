import React, { useEffect, useMemo, useState } from "react";
import { ProductoCatalogo } from "@/types/inventory";
import { apiFetch } from "@/lib/api";

import { PageHero } from "@/components/layout/PageHero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  Loader2,
  RefreshCcw,
} from "lucide-react";

export default function Catalogo() {
  const [items, setItems] = useState<ProductoCatalogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

      const response = await apiFetch("/catalogo/productos");

      if (!response.ok) {
        throw new Error("No se pudo cargar el catálogo.");
      }

      const data = await response.json();

      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando catálogo:", error);

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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

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
      setSaving(true);

      const response = await apiFetch("/catalogo/productos", {
        method: "POST",
        body: JSON.stringify({
          sku: skuClean,
          nombre: nombreClean,
          descripcion: descripcionClean || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "No se pudo crear el registro.");
      }

      toast({
        title: "Registro agregado",
        description: `${nombreClean} fue agregado al catálogo.`,
      });

      clearForm();
      await loadCatalog();
    } catch (error) {
      console.error("Error creando registro:", error);

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo agregar el registro al catálogo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
    if (!editingSku || saving) return;

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
      setSaving(true);

      const response = await apiFetch(
        `/catalogo/productos/${encodeURIComponent(item.sku)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            sku: item.sku,
            nombre: nombreClean,
            descripcion: descripcionClean || null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "No se pudo actualizar el registro.");
      }

      toast({
        title: "Registro actualizado",
        description: "El catálogo fue actualizado correctamente.",
      });

      cancelEdit();
      await loadCatalog();
    } catch (error) {
      console.error("Error actualizando registro:", error);

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el registro.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ProductoCatalogo) => {
    if (saving) return;

    const confirmed = window.confirm(
      `¿Eliminar del catálogo el producto "${item.nombre}"?\n\nEsta acción no elimina movimientos históricos.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const response = await apiFetch(
        `/catalogo/productos/${encodeURIComponent(item.sku)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          title: "No se pudo eliminar",
          description:
            data?.detail ||
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
      console.error("Error eliminando registro:", error);

      toast({
        title: "Error",
        description: "No se pudo eliminar el registro.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHero
        badge="Identidad histórica de productos"
        title="Catálogo"
        description="Administra los registros base de productos: SKU, nombre y descripción."
        icon={BookOpen}
        stats={[
          {
            label: "Registros totales",
            value: items.length,
            tone: "blue",
          },
          {
            label: "Resultados visibles",
            value: filteredItems.length,
            tone: "green",
          },
          {
            label: "Modo",
            value: editingSku ? "Editando" : "Consulta",
            tone: editingSku ? "amber" : "purple",
          },
          {
            label: "Datos guardados",
            value: "SKU / Nombre",
            tone: "cyan",
          },
        ]}
      >
        El catálogo solo guarda la identidad del producto. Los costos,
        caducidades, cantidades y ubicaciones se controlan desde inventario y
        lotes.
      </PageHero>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar registro al catálogo
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Usa esta sección para crear productos base que después podrás
            reutilizar al agregar inventario.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="catalog-sku">SKU *</Label>
              <Input
                id="catalog-sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Ej: COCA600"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-nombre">Nombre *</Label>
              <Input
                id="catalog-nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej: Coca Cola 600 ml"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2 md:row-span-2">
              <Label htmlFor="catalog-descripcion">Descripción</Label>
              <Textarea
                id="catalog-descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                placeholder="Descripción del producto..."
                rows={4}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearForm}
                disabled={saving}
              >
                Limpiar
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Registros del catálogo
              </CardTitle>

              <p className="text-sm text-muted-foreground mt-1">
                Consulta, edita o elimina registros base. El SKU se mantiene
                bloqueado para evitar duplicados históricos.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={loadCatalog}
              disabled={loading || saving}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por SKU, nombre o descripción..."
              className="pl-9"
              disabled={loading}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Cargando catálogo...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              No hay registros en catálogo.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
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
                      <tr key={item.sku} className="border-t hover:bg-muted/40">
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-2 font-mono">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <span className="break-all">{item.sku}</span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">
                            El SKU no se puede editar.
                          </p>
                        </td>

                        <td className="p-3 align-top min-w-[220px]">
                          {isEditing ? (
                            <Input
                              value={editNombre}
                              onChange={(event) =>
                                setEditNombre(event.target.value)
                              }
                              disabled={saving}
                            />
                          ) : (
                            <span className="font-medium">{item.nombre}</span>
                          )}
                        </td>

                        <td className="p-3 align-top min-w-[320px]">
                          {isEditing ? (
                            <Textarea
                              value={editDescripcion}
                              onChange={(event) =>
                                setEditDescripcion(event.target.value)
                              }
                              rows={2}
                              disabled={saving}
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
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      Guardando
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-1" />
                                      Guardar
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  disabled={saving}
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
                                  disabled={saving}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(item)}
                                  disabled={saving}
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

          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            Nota: el catálogo no almacena costos, cantidades ni caducidades. Esa
            información se registra únicamente cuando el producto entra al
            inventario.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
