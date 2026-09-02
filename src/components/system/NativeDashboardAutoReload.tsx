import { useEffect } from "react";

const VERSION_KEY = "racknova.native.dashboard.version";
const POLL_INTERVAL_MS = 20_000;
const IDLE_BEFORE_RELOAD_MS = 30_000;
const SAFE_CHECK_INTERVAL_MS = 5_000;

const isNativeDashboard = () => import.meta.env.BASE_URL === "/ui/";

export function NativeDashboardAutoReload() {
  useEffect(() => {
    if (!isNativeDashboard()) {
      return;
    }

    let stopped = false;
    let pendingVersion: string | null = null;
    let lastInteractionAt = Date.now();

    const rememberInteraction = () => {
      lastInteractionAt = Date.now();
    };

    const reloadIntoVersion = (version: string) => {
      try {
        sessionStorage.setItem(VERSION_KEY, version);
      } catch {
        // La recarga sigue siendo segura aunque sessionStorage no esté disponible.
      }
      window.location.reload();
    };

    const reloadIfSafe = () => {
      if (!pendingVersion || stopped) {
        return;
      }

      // Si el usuario cambió de pestaña, esperamos a que vuelva. Así evitamos
      // una recarga inesperada mientras está trabajando en otra ventana.
      if (document.visibilityState !== "visible") {
        return;
      }

      const idleFor = Date.now() - lastInteractionAt;
      if (idleFor >= IDLE_BEFORE_RELOAD_MS) {
        const version = pendingVersion;
        pendingVersion = null;
        reloadIntoVersion(version);
      }
    };

    const checkVersion = async () => {
      try {
        const response = await fetch(
          `${window.location.origin}/racknova-native/dashboard-update/status`,
          {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );

        if (!response.ok) {
          return;
        }

        const status = await response.json();
        const version = String(status?.installed_version || "").trim();
        if (!version) {
          return;
        }

        let knownVersion = "";
        try {
          knownVersion = sessionStorage.getItem(VERSION_KEY) || "";
        } catch {
          knownVersion = "";
        }

        if (!knownVersion) {
          try {
            sessionStorage.setItem(VERSION_KEY, version);
          } catch {
            // Sin persistencia, simplemente usaremos esta versión como baseline.
          }
          return;
        }

        if (knownVersion !== version) {
          pendingVersion = version;
          reloadIfSafe();
        }
      } catch {
        // El Dashboard Local debe seguir funcionando aunque el endpoint de
        // actualización no esté disponible temporalmente.
      }
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, rememberInteraction, { passive: true });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingVersion) {
        // Al volver a la pestaña, la versión nueva ya está instalada. Cargamos
        // inmediatamente para que el usuario no siga usando archivos viejos.
        const version = pendingVersion;
        pendingVersion = null;
        reloadIntoVersion(version);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    void checkVersion();
    const pollTimer = window.setInterval(() => {
      void checkVersion();
    }, POLL_INTERVAL_MS);
    const safeReloadTimer = window.setInterval(
      reloadIfSafe,
      SAFE_CHECK_INTERVAL_MS,
    );

    return () => {
      stopped = true;
      window.clearInterval(pollTimer);
      window.clearInterval(safeReloadTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, rememberInteraction);
      });
    };
  }, []);

  return null;
}
