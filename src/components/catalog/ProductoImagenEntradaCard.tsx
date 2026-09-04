import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  guardarImagenProducto,
  obtenerImagenProducto,
  prepararImagenProducto,
  type PreparedProductImage,
} from "@/lib/productImages";

export function ProductoImagenEntradaCard() {
  const [pending, setPending] = useState<PreparedProductImage | null>(null);
  const [fileName, setFileName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const clear = () => {
    setPending(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setPreparing(true);
      const prepared = await prepararImagenProducto(file);
      setPending(prepared);
      setFileName(file.name);
    } catch (error) {
      clear();
      toast({
        title: "No se pudo preparar la imagen",
        description: error instanceof Error ? error.message : "Selecciona otra imagen.",
        variant: "destructive",
      });
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    const onProductSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ sku?: string; nombre?: string }>).detail;
      const sku = String(detail?.sku || "").trim();
      if (!sku || !pending) return;

      void (async () => {
        try {
          setSaving(true);
          const existing = await obtenerImagenProducto(sku, true);
          if (existing) {
            toast({
              title: "Imagen existente reutilizada",
              description: `${detail?.nombre || sku} ya tenía imagen en catálogo. RackNova conservó la misma.`,
            });
            clear();
            return;
          }

          await guardarImagenProducto(sku, pending);
          toast({
            title: "Imagen guardada",
            description: `La foto quedó asociada al SKU ${sku} y se reutilizará en futuras entradas y en Punto de Venta.`,
          });
          clear();
        } catch (error) {
          toast({
            title: "Producto guardado, imagen pendiente",
            description:
              error instanceof Error
                ? error.message
                : "El producto se guardó, pero no fue posible registrar su imagen.",
            variant: "destructive",
          });
        } finally {
          setSaving(false);
        }
      })();
    };

    window.addEventListener("racknova:product-saved", onProductSaved);
    return () => window.removeEventListener("racknova:product-saved", onProductSaved);
  }, [pending, toast]);

  return (
    <Card className="racknova-card border-violet-200/70 dark:border-violet-900/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ImageIcon className="h-5 w-5 text-violet-600" />
          Imagen del producto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-[112px_1fr] sm:items-center">
          <div className="h-28 w-28 overflow-hidden rounded-2xl border bg-muted/40">
            {pending ? (
              <img
                src={pending.data_url}
                alt="Vista previa"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">
                Solo necesitas subirla cuando el artículo todavía no tiene foto.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Si el SKU ya existe con imagen, RackNova conservará esa misma automáticamente. La foto es opcional y se comprime antes de enviarse.
              </p>
            </div>

            {fileName && (
              <p className="text-xs text-muted-foreground">
                {fileName} · {Math.max(1, Math.round((pending?.byte_size || 0) / 1024))} KB
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFile}
                disabled={preparing || saving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={preparing || saving}
              >
                {preparing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {pending ? "Cambiar imagen" : "Seleccionar imagen"}
              </Button>

              {pending && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clear}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Quitar selección
                </Button>
              )}

              {saving && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando imagen al terminar la entrada…
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
