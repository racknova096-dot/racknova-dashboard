import { useState } from "react";
import {
  Barcode,
  Camera,
  MapPinCheck,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  guardarConfiguracionScan,
  type RackNovaScanConfig,
} from "@/lib/scanControl";

type Props = {
  config: RackNovaScanConfig;
  onChange: (next: RackNovaScanConfig) => void;
};

type BooleanConfigKey =
  | "escaneo_habilitado"
  | "pos_verificacion_requerida"
  | "ubicacion_verificacion_requerida"
  | "hid_habilitado"
  | "camara_habilitada";

const FLOW_ITEMS = [
  {
    key: "pos_verificacion_requerida" as const,
    title: "Verificar productos antes de cobrar",
    description:
      "Los productos agregados manualmente deben coincidir con una lectura física antes de habilitar el cobro.",
    icon: ShieldCheck,
    accent: "text-emerald-600",
  },
  {
    key: "ubicacion_verificacion_requerida" as const,
    title: "Verificar ubicación al reabastecer",
    description:
      "Solicita escanear la etiqueta RNLOC asignada antes de confirmar una nueva entrada de inventario.",
    icon: MapPinCheck,
    accent: "text-violet-600",
  },
];

const READER_ITEMS = [
  {
    key: "hid_habilitado" as const,
    title: "Pistola USB / Bluetooth",
    description:
      "Acepta lectores que funcionan como teclado HID, incluso cuando el buscador no tiene el foco.",
    icon: Barcode,
    accent: "text-blue-600",
  },
  {
    key: "camara_habilitada" as const,
    title: "Cámara del dispositivo",
    description:
      "Muestra el botón de cámara para leer QR, Code128, Code39, EAN, UPC e ITF.",
    icon: Camera,
    accent: "text-cyan-600",
  },
];

type Item = (typeof FLOW_ITEMS)[number] | (typeof READER_ITEMS)[number];

export function ScanControlPanel({ config, onChange }: Props) {
  const [savingKey, setSavingKey] = useState<BooleanConfigKey | null>(null);
  const hasReader = config.hid_habilitado || config.camara_habilitada;

  const toggle = async (key: BooleanConfigKey, value: boolean) => {
    if (savingKey) return;
    setSavingKey(key);
    const previous = config;
    const patch: Partial<RackNovaScanConfig> = { [key]: value };

    if (key === "escaneo_habilitado" && !value) {
      patch.pos_verificacion_requerida = false;
      patch.ubicacion_verificacion_requerida = false;
    }

    const nextHid = key === "hid_habilitado" ? value : config.hid_habilitado;
    const nextCamera =
      key === "camara_habilitada" ? value : config.camara_habilitada;
    if (!nextHid && !nextCamera) {
      patch.pos_verificacion_requerida = false;
      patch.ubicacion_verificacion_requerida = false;
    }

    onChange({ ...config, ...patch });

    try {
      const saved = await guardarConfiguracionScan(patch);
      onChange(saved);
      toast.success("Configuración guardada en este dispositivo.");
    } catch (error) {
      onChange(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración de escaneo."
      );
    } finally {
      setSavingKey(null);
    }
  };

  const renderItem = (item: Item, disabled: boolean) => {
    const Icon = item.icon;
    const checked = Boolean(config[item.key]);
    return (
      <div
        key={item.key}
        className={`flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm transition-opacity sm:min-h-[132px] sm:gap-4 sm:rounded-2xl sm:p-4 ${
          disabled ? "opacity-55" : ""
        }`}
      >
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/65 sm:h-10 sm:w-10">
            <Icon className={`h-5 w-5 ${item.accent}`} />
          </div>
          <div>
            <p className="text-sm font-black">{item.title}</p>
            <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
              {item.description}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:mt-2">
              {checked ? "Activo aquí" : "Desactivado aquí"}
            </p>
          </div>
        </div>
        <Switch
          checked={checked}
          disabled={savingKey !== null || disabled}
          onCheckedChange={(value) => void toggle(item.key, value)}
          aria-label={item.title}
        />
      </div>
    );
  };

  return (
    <section className="rn-pos-surface overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border/60 px-3.5 py-3.5 sm:gap-3 sm:px-5 sm:py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11 sm:rounded-2xl">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">Escaneo y verificación</h2>
              <Badge variant="secondary" className="rounded-full">
                Este usuario y dispositivo
              </Badge>
            </div>
            <p className="mt-1 hidden max-w-2xl text-sm leading-5 text-muted-foreground sm:block">
              Estos ajustes no cambian otras cajas, computadoras, tablets o celulares.
            </p>
          </div>
        </div>
        <span className="hidden text-xs font-semibold text-muted-foreground sm:block">
          Configuración local
        </span>
      </div>

      <div className="space-y-3 p-3 sm:space-y-5 sm:p-4">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-2xl sm:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:h-11 sm:w-11 sm:rounded-2xl">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black">Usar funciones de escaneo</p>
              <p className="mt-1 hidden text-sm leading-5 text-muted-foreground sm:block">
                Al desactivarlo, RackNova trabajará con búsqueda y captura manual y ocultará los lectores.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs font-bold text-muted-foreground">
              {config.escaneo_habilitado ? "Escaneo activo" : "Modo manual"}
            </span>
            <Switch
              checked={config.escaneo_habilitado}
              disabled={savingKey !== null}
              onCheckedChange={(value) =>
                void toggle("escaneo_habilitado", value)
              }
              aria-label="Usar funciones de escaneo"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Lectores disponibles
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {READER_ITEMS.map((item) =>
              renderItem(item, !config.escaneo_habilitado)
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Reglas de operación
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {FLOW_ITEMS.map((item) =>
              renderItem(item, !config.escaneo_habilitado || !hasReader)
            )}
          </div>
        </div>

        {config.escaneo_habilitado && !hasReader && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
            Activa al menos un lector para utilizar las verificaciones físicas.
          </p>
        )}
      </div>
    </section>
  );
}
