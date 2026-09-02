import { useEffect } from "react";

const LIVE_REFRESH_INTERVAL_MS = 8_000;
const LIVE_REFRESH_EVENT = "racknova:inventory-updated";

const isNativeDashboard = () => import.meta.env.BASE_URL === "/ui/";

const refreshVisiblePOS = () => {
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  if (!currentPath.endsWith("/pos")) {
    return;
  }

  const refreshButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => {
    const label = (button.textContent || "").replace(/\s+/g, " ").trim();
    return !button.disabled && label === "Actualizar";
  });

  refreshButton?.click();
};

export function NativeLiveDataRefresh() {
  useEffect(() => {
    if (!isNativeDashboard()) {
      return;
    }

    let stopped = false;

    const pulse = () => {
      if (stopped || document.visibilityState !== "visible") {
        return;
      }

      const token = localStorage.getItem("access_token");
      if (!token) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent(LIVE_REFRESH_EVENT, {
          detail: {
            source: "native-live-refresh",
            silent: true,
            at: Date.now(),
          },
        }),
      );

      // Punto de Venta mantiene su propio estado para caja e historial.
      // Reutilizamos su acción oficial "Actualizar" para reflejar ventas
      // sincronizadas desde Cloud sin tocar carrito, cobro o formulario activo.
      refreshVisiblePOS();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pulse();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const timer = window.setInterval(pulse, LIVE_REFRESH_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
