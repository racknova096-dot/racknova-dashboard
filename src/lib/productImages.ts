import { apiFetch } from "@/lib/api";

export type PreparedProductImage = {
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  data_base64: string;
  data_url: string;
  byte_size: number;
};

type ProductImageApiResponse = {
  sku: string;
  mime_type: string;
  data_base64?: string;
  byte_size?: number;
  sha256?: string;
  fecha_actualizacion?: string;
};

const imageCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const normalizeSku = (sku: string) => String(sku || "").trim();

const base64Bytes = (base64: string) =>
  Math.floor((base64.length * 3) / 4) -
  (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

const loadBrowserImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };
    image.src = url;
  });

const renderCompressed = (
  image: HTMLImageElement,
  maxSide: number,
  quality: number
): PreparedProductImage => {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("El navegador no pudo preparar la imagen.");

  context.drawImage(image, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/webp", quality);
  let mime: PreparedProductImage["mime_type"] = "image/webp";

  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    mime = "image/jpeg";
  }

  const base64 = dataUrl.split(",", 2)[1] || "";
  return {
    mime_type: mime,
    data_base64: base64,
    data_url: dataUrl,
    byte_size: base64Bytes(base64),
  };
};

export async function prepararImagenProducto(file: File): Promise<PreparedProductImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La foto original supera 12 MB. Usa una imagen más ligera.");
  }

  const image = await loadBrowserImage(file);
  const attempts: Array<[number, number]> = [
    [900, 0.82],
    [820, 0.76],
    [720, 0.72],
    [640, 0.68],
  ];

  let latest: PreparedProductImage | null = null;
  for (const [side, quality] of attempts) {
    latest = renderCompressed(image, side, quality);
    if (latest.byte_size <= 700 * 1024) return latest;
  }

  if (!latest || latest.byte_size > 800 * 1024) {
    throw new Error("No fue posible comprimir la imagen por debajo de 800 KB.");
  }
  return latest;
}

export async function obtenerImagenProducto(
  sku: string,
  force = false
): Promise<string | null> {
  const clean = normalizeSku(sku);
  if (!clean) return null;

  if (force) {
    imageCache.delete(clean);
    inflight.delete(clean);
  } else if (imageCache.has(clean)) {
    return imageCache.get(clean) ?? null;
  }

  const existing = inflight.get(clean);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await apiFetch(
        `/catalogo/productos/${encodeURIComponent(clean)}/imagen`
      );
      if (response.status === 404) {
        imageCache.set(clean, null);
        return null;
      }
      if (!response.ok) return null;

      const data = (await response.json()) as ProductImageApiResponse;
      if (!data?.data_base64 || !data?.mime_type) {
        imageCache.set(clean, null);
        return null;
      }
      const url = `data:${data.mime_type};base64,${data.data_base64}`;
      imageCache.set(clean, url);
      return url;
    } catch (error) {
      console.warn("RackNova: no se pudo cargar la imagen del producto", clean, error);
      return null;
    } finally {
      inflight.delete(clean);
    }
  })();

  inflight.set(clean, request);
  return request;
}

export async function guardarImagenProducto(
  sku: string,
  image: PreparedProductImage
): Promise<void> {
  const clean = normalizeSku(sku);
  if (!clean) throw new Error("SKU inválido para guardar la imagen.");

  const response = await apiFetch(
    `/catalogo/productos/${encodeURIComponent(clean)}/imagen`,
    {
      method: "PUT",
      body: JSON.stringify({
        mime_type: image.mime_type,
        data_base64: image.data_base64,
      }),
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo guardar la imagen del producto.");
  }

  imageCache.set(clean, image.data_url);
  window.dispatchEvent(
    new CustomEvent("racknova:product-image-updated", {
      detail: { sku: clean },
    })
  );
}

export async function eliminarImagenProducto(sku: string): Promise<void> {
  const clean = normalizeSku(sku);
  if (!clean) return;

  const response = await apiFetch(
    `/catalogo/productos/${encodeURIComponent(clean)}/imagen`,
    { method: "DELETE" }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "No se pudo eliminar la imagen.");
  }

  imageCache.set(clean, null);
  window.dispatchEvent(
    new CustomEvent("racknova:product-image-updated", {
      detail: { sku: clean },
    })
  );
}

export function limpiarCacheImagenProducto(sku?: string) {
  if (sku) {
    const clean = normalizeSku(sku);
    imageCache.delete(clean);
    inflight.delete(clean);
    return;
  }
  imageCache.clear();
  inflight.clear();
}
