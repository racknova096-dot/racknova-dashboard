import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Barcode,
  Camera,
  CheckCircle2,
  Laptop,
  Loader2,
  LockKeyhole,
  ScanLine,
  Settings,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/layout/PageHero";
import { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";
import { ScanControlPanel } from "@/components/scanner/ScanControlPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRackNovaScanner } from "@/hooks/useRackNovaScanner";
import {
  DEFAULT_SCAN_CONFIG,
  obtenerConfiguracionScan,
  type RackNovaScanConfig,
} from "@/lib/scanControl";
import type { RackNovaScanResult } from "@/lib/racknovaScan";

type CameraPermission =
  | "checking"
  | "granted"
  | "prompt"
  | "denied"
  | "unavailable"
  | "insecure";

const permissionCopy: Record<
  CameraPermission,
  { label: string; description: string; tone: string }
> = {
  checking: {
    label: "Comprobando",
    description: "Revisando el acceso disponible en este navegador.",
    tone: "bg-secondary text-muted-foreground",
  },
  granted: {
    label: "Permitida",
    description: "La cámara está autorizada y lista para probarse.",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  prompt: {
    label: "Sin solicitar",
    description: "El navegador pedirá permiso cuando hagas la prueba.",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  denied: {
    label: "Bloqueada",
    description:
      "La cámara fue bloqueada. Habilítala desde los permisos del sitio en el navegador.",
    tone: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  unavailable: {
    label: "No disponible",
    description: "Este navegador o dispositivo no ofrece acceso a una cámara.",
    tone: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
  insecure: {
    label: "Requiere HTTPS",
    description:
      "Los navegadores móviles bloquean la cámara en conexiones HTTP. Abre RackNova mediante HTTPS.",
    tone: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
};

export default function Configuracion() {
  const [config, setConfig] = useState<RackNovaScanConfig>(DEFAULT_SCAN_CONFIG);
  const [cameraPermission, setCameraPermission] =
    useState<CameraPermission>("checking");
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lastScan, setLastScan] = useState<RackNovaScanResult | null>(null);

  const refreshCameraPermission = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setCameraPermission("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission("unavailable");
      return;
    }

    if (!navigator.permissions?.query) {
      setCameraPermission("prompt");
      return;
    }

    try {
      const result = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      setCameraPermission(result.state as "granted" | "prompt" | "denied");
      result.onchange = () =>
        setCameraPermission(result.state as "granted" | "prompt" | "denied");
    } catch {
      setCameraPermission("prompt");
    }
  }, []);

  useEffect(() => {
    void obtenerConfiguracionScan().then(setConfig);
    void refreshCameraPermission();

    const handleConfig = (event: Event) => {
      const custom = event as CustomEvent<RackNovaScanConfig>;
      if (custom.detail) setConfig(custom.detail);
    };
    window.addEventListener("racknova:scan-config-local", handleConfig);
    return () =>
      window.removeEventListener("racknova:scan-config-local", handleConfig);
  }, [refreshCameraPermission]);

  const handleScan = useCallback((scan: RackNovaScanResult) => {
    setLastScan(scan);
    toast.success("Lectura recibida correctamente.");
  }, []);

  useRackNovaScanner({
    enabled:
      config.escaneo_habilitado && config.hid_habilitado && !cameraOpen,
    onScan: handleScan,
  });

  const requestCamera = async () => {
    if (cameraPermission === "insecure" || cameraPermission === "unavailable") {
      return;
    }
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission("granted");
      toast.success("Permiso de cámara confirmado.");
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setCameraPermission(denied ? "denied" : "unavailable");
      toast.error(
        denied
          ? "El navegador bloqueó el acceso a la cámara."
          : "No fue posible iniciar una cámara en este dispositivo."
      );
    } finally {
      setRequestingCamera(false);
    }
  };

  const permission = permissionCopy[cameraPermission];
  const activeReaders = useMemo(() => {
    if (!config.escaneo_habilitado) return "Modo manual";
    const readers = [
      config.hid_habilitado ? "Pistola" : null,
      config.camara_habilitada ? "Cámara" : null,
    ].filter(Boolean);
    return readers.length ? readers.join(" + ") : "Sin lectores";
  }, [config]);

  return (
    <main className="space-y-6">
      <PageHero
        badge="Preferencias del dispositivo"
        title="Configuración"
        description="Decide cómo escanea y verifica RackNova en esta computadora, tablet o celular."
        icon={Settings}
        stats={[
          {
            label: "Modo",
            value: config.escaneo_habilitado ? "Escaneo" : "Manual",
            tone: config.escaneo_habilitado ? "green" : "default",
          },
          { label: "Lectores", value: activeReaders, tone: "blue" },
          {
            label: "Cámara",
            value: permission.label,
            tone: cameraPermission === "granted" ? "green" : "amber",
          },
          { label: "Alcance", value: "Este dispositivo", tone: "purple" },
        ]}
      >
        Las preferencias permanecen en este usuario y navegador. Así cada caja
        puede trabajar con su propia pistola, cámara o captura manual.
      </PageHero>

      <ScanControlPanel config={config} onChange={setConfig} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="racknova-card overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-cyan-600" />
              Permiso de cámara
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/25 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
                {cameraPermission === "granted" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : cameraPermission === "checking" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div className="min-w-0">
                <Badge className={permission.tone}>{permission.label}</Badge>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {permission.description}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={
                  requestingCamera ||
                  cameraPermission === "checking" ||
                  cameraPermission === "insecure" ||
                  cameraPermission === "unavailable"
                }
                onClick={() => void requestCamera()}
              >
                {requestingCamera ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="mr-2 h-4 w-4" />
                )}
                Solicitar permiso
              </Button>
              <Button
                type="button"
                className="h-11"
                disabled={
                  !config.escaneo_habilitado ||
                  !config.camara_habilitada ||
                  cameraPermission !== "granted"
                }
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="mr-2 h-4 w-4" />
                Probar escáner
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Barcode className="h-5 w-5 text-blue-600" />
              Prueba de lectura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-secondary/25 p-4">
                <Laptop className="h-5 w-5 text-blue-600" />
                <p className="mt-2 text-sm font-black">Pistola HID</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Escanea cualquier etiqueta mientras esta pantalla está abierta.
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-secondary/25 p-4">
                <Smartphone className="h-5 w-5 text-cyan-600" />
                <p className="mt-2 text-sm font-black">Cámara móvil</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Usa preferentemente la cámara trasera y buena iluminación.
                </p>
              </div>
            </div>

            <div className="min-h-[105px] rounded-2xl border border-dashed border-border bg-background p-4">
              {lastScan ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-black">Lectura correcta</p>
                    <p className="mt-1 break-all font-mono text-sm">{lastScan.code}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Origen: {lastScan.source === "camera" ? "cámara" : "pistola"} · Tipo: {lastScan.kind === "location" ? "ubicación" : lastScan.kind === "product" ? "producto" : "desconocido"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-muted-foreground">
                  <ScanLine className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Esperando una lectura
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      Aquí verás el código, el lector utilizado y cómo lo clasificó RackNova.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <RackNovaScannerDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onScan={handleScan}
        title="Probar cámara"
        description="La lectura es solo una prueba y no modifica inventario ni ventas."
      />
    </main>
  );
}
