import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, RefreshCcw, Search, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import {
  eliminarImagenProducto,
  guardarImagenProducto,
  prepararImagenProducto,
} from "@/lib/productImages";
import type { ProductoCatalogo } from "@/types/inventory";
import { ProductImage } from "./ProductImage";

const PAGE_SIZE = 30;

export function CatalogoImagenesPanel() {
  const [items, setItems] = useState<ProductoCatalogo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingSku, setWorkingSku] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/catalogo/productos");
      if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: "No se pudieron cargar las imágenes",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("racknova:catalog-updated", refresh);
    return () => window.removeEventListener("racknova:catalog-updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.sku, item.nombre, item.descripcion || ""].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [items, search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleItems = filtered.slice(0, visibleCount);

  const onFile = async (item: ProductoCatalogo, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setWorkingSku(item.sku);
      const prepared = await prepararImagenProducto(file);
      await guardarImagenProducto(item.sku, prepared);
      toast({
        title: "Imagen actualizada",
        description: `${item.nombre} ya usa esta imagen en RackNova.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo guardar la imagen",
        description: error instanceof Error ? error.message : "Selecciona otra imagen.",
        variant: "destructive",
      });
    } finally {
      setWorkingSku(null);
    }
  };

  const remove = async (item: ProductoCatalogo) => {
    if (!window.confirm(`¿Quitar la imagen de ${item.nombre}?`)) return;
    try {
      setWorkingSku(item.sku);
      await eliminarImagenProducto(item.sku);
      toast({
        title: "Imagen eliminada",
        description: `${item.nombre} volverá a mostrar el icono genérico.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo eliminar la imagen",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setWorkingSku(null);
    }
  };

  return (
    <Card className="racknova-card">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-violet-600" />
              Imágenes del catálogo
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Una sola imagen por SKU. Se reutiliza automáticamente en nuevas entradas y en Punto de Venta.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto para cambiar su imagen..."
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando catálogo…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay productos para mostrar.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => {
                const busy = workingSku === item.sku;
                return (
                  <div
                    key={item.sku}
                    className="flex gap-3 rounded-2xl border bg-background p-3"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-muted/40">
                      <ProductImage sku={item.sku} alt={item.nombre} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.sku}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          ref={(node) => {
                            fileInputs.current[item.sku] = node;
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={busy}
                          onChange={(event) => void onFile(item, event)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => fileInputs.current[item.sku]?.click()}
                        >
                          {busy ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="mr-1 h-3.5 w-3.5" />
                          )}
                          Subir / cambiar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => void remove(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleCount < filtered.length && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                >
                  Mostrar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
