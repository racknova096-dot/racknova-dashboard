import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

import { obtenerImagenProducto } from "@/lib/productImages";

export function ProductImage({
  sku,
  alt,
  className = "h-full w-full object-cover",
  fallbackClassName = "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
}: {
  sku: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void obtenerImagenProducto(sku).then((value) => {
      if (!active) return;
      setUrl(value);
      setLoading(false);
    });

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ sku?: string }>).detail;
      if (detail?.sku !== sku) return;
      void obtenerImagenProducto(sku, true).then((value) => {
        if (!active) return;
        setUrl(value);
        setLoading(false);
      });
    };

    window.addEventListener("racknova:product-image-updated", onUpdated);
    return () => {
      active = false;
      window.removeEventListener("racknova:product-image-updated", onUpdated);
    };
  }, [sku]);

  if (url) {
    return <img src={url} alt={alt || sku} className={className} loading="lazy" />;
  }

  return (
    <div className={fallbackClassName} aria-label={loading ? "Cargando imagen" : "Sin imagen"}>
      <ImageIcon className={`h-5 w-5 ${loading ? "animate-pulse" : ""}`} />
    </div>
  );
}
