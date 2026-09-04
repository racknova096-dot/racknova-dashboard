import { useEffect, useRef } from "react";

import PuntoVenta from "./PuntoVenta";

const OLD_TITLE = "Catálogo visual preparado";
const NEW_TITLE = "Catálogo visual activo";
const OLD_DESCRIPTION =
  "Busca un producto para mostrarlo aquí. El espacio de imagen ya está listo para la próxima actualización de fotografías.";
const NEW_DESCRIPTION =
  "Las fotografías del catálogo ya están activas. Busca por nombre, SKU o código de barras y RackNova mostrará la imagen guardada del producto.";

export default function PuntoVentaApp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncCatalogCopy = () => {
      root.querySelectorAll<HTMLElement>("h3, p").forEach((element) => {
        const text = element.textContent?.trim();
        if (text === OLD_TITLE) {
          element.textContent = NEW_TITLE;
        } else if (text === OLD_DESCRIPTION) {
          element.textContent = NEW_DESCRIPTION;
        }
      });
    };

    syncCatalogCopy();

    const observer = new MutationObserver(syncCatalogCopy);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="contents">
      <PuntoVenta />
    </div>
  );
}
