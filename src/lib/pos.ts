export * from "./posBase";

// Compatibilidad del empaquetador nativo: los endpoints /pos/estado y
// /pos/configuracion se implementan y exportan desde ./posBase.
import {
  buscarProductosPOS as buscarProductosPOSBase,
  type POSProducto,
} from "./posBase";
import { obtenerImagenProducto } from "@/lib/productImages";

export const buscarProductosPOS = async (
  query: string,
  idCliente?: number | null
): Promise<POSProducto[]> => {
  const rows = await buscarProductosPOSBase(query, idCliente);

  const images = await Promise.all(
    rows.map((product) => obtenerImagenProducto(product.sku))
  );

  return rows.map((product, index) => {
    const image = images[index];
    return image ? { ...product, imagen: image } : product;
  });
};