import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Share2,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRackNovaPwaState,
  promptRackNovaInstall,
  type RackNovaPwaState,
} from "@/lib/pwa";

const STATE_COPY: Record<
  RackNovaPwaState,
  { label: string; description: string; tone: string }
> = {
  installed: {
    label: "Instalada",
    description: "RackNova ya se abre como aplicación independiente en este dispositivo.",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  available: {
    label: "Lista para instalar",
    description: "Puedes agregar RackNova a la pantalla de inicio con su propio icono.",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ios: {
    label: "Instalable en iPhone/iPad",
    description: "En Safari usa Compartir y después “Agregar a pantalla de inicio”.",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  browser: {
    label: "Disponible desde el navegador",
    description: "Si no aparece el botón, abre el menú del navegador y elige “Instalar aplicación”.",
    tone: "bg-secondary text-muted-foreground",
  },
  insecure: {
    label: "Requiere HTTPS",
    description:
      "Esta dirección usa HTTP. Los navegadores móviles no permiten instalar una PWA desde una IP local sin HTTPS.",
    tone: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
  unsupported: {
    label: "No disponible",
    description: "Este navegador no ofrece instalación como aplicación.",
    tone: "bg-secondary text-muted-foreground",
  },
};

export function PwaInstallCard() {
  const [state, setState] = useState<RackNovaPwaState>(() =>
    getRackNovaPwaState()
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const refresh = () => setState(getRackNovaPwaState());
    window.addEventListener("racknova:pwa-state", refresh);
    window.addEventListener("focus", refresh);
    refresh();

    return () => {
      window.removeEventListener("racknova:pwa-state", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const copy = STATE_COPY[state];

  const action = useMemo(() => {
    if (state === "installed") return "RackNova instalada";
    if (state === "available") return "Instalar RackNova";
    if (state === "ios") return "Usar Compartir en Safari";
    if (state === "insecure") return "HTTPS requerido";
    return "Ver opciones de instalación";
  }, [state]);

  const handleInstall = async () => {
    if (state !== "available") {
      if (state === "ios") {
        toast.info("En Safari: Compartir → Agregar a pantalla de inicio.");
      } else if (state === "browser") {
        toast.info("Abre el menú del navegador y elige “Instalar aplicación”.");
      }
      return;
    }

    setInstalling(true);
    try {
      const outcome = await promptRackNovaInstall();
      if (outcome === "accepted") {
        toast.success("RackNova se agregó como aplicación.");
      } else if (outcome === "dismissed") {
        toast.info("Instalación cancelada. Puedes intentarlo de nuevo cuando quieras.");
      } else {
        toast.info("Usa la opción “Instalar aplicación” del navegador.");
      }
    } finally {
      setInstalling(false);
      setState(getRackNovaPwaState());
    }
  };

  return (
    <Card className="racknova-card overflow-hidden">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5 text-blue-600" />
          Aplicación móvil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/25 p-3 sm:rounded-2xl sm:p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 shadow-sm dark:bg-white">
            {state === "installed" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 dark:text-emerald-600" />
            ) : state === "insecure" ? (
              <ShieldAlert className="h-6 w-6 text-amber-400 dark:text-amber-600" />
            ) : (
              <Smartphone className="h-6 w-6 text-cyan-300 dark:text-blue-600" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">RackNova</p>
              <Badge className={copy.tone}>{copy.label}</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>

        {state === "insecure" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
            RackNova Local puede seguir usándose desde el navegador por LAN. Para
            instalarlo directamente desde una dirección como{" "}
            <span className="font-mono">http://192.168.x.x:8000/ui/</span>, el
            siguiente requisito técnico es habilitar HTTPS local.
          </div>
        )}

        {state === "ios" && (
          <div className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-border/60 p-3 text-sm">
            <Share2 className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="font-bold">Instalar en iPhone o iPad</p>
              <p className="mt-1 text-muted-foreground">
                Abre RackNova en Safari, toca Compartir y selecciona “Agregar a
                pantalla de inicio”.
              </p>
            </div>
          </div>
        )}

        <Button
          type="button"
          className="h-11 w-full sm:w-auto"
          variant={state === "installed" || state === "insecure" ? "outline" : "default"}
          disabled={state === "installed" || state === "insecure" || state === "unsupported" || installing}
          onClick={() => void handleInstall()}
        >
          {state === "available" ? (
            <Download className="mr-2 h-4 w-4" />
          ) : state === "ios" ? (
            <Share2 className="mr-2 h-4 w-4" />
          ) : state === "installed" ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          {installing ? "Abriendo instalación..." : action}
        </Button>
      </CardContent>
    </Card>
  );
}
