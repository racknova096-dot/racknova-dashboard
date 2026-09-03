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
  canManage?: boolean;
  onChange: (next: RackNovaScanConfig) => void;
};

type BooleanConfigKey =
  | "pos_verificacion_requerida"
  | "ubicacion_verificacion_requerida"
  | "hid_habilitado"
  | "camara_habilitada";

const ITEMS: Array<{
  key: BooleanConfigKey;
  title: string;
  description: string;
  icon: typeof ScanLine;
  accent: string;
}> = [
  {
    key: "pos_verificacion_requerida",
    title: "Confirmar productos antes de cobrar",
    description:
      "Si lo activas en este dispositivo, los productos elegidos manualmente deben coincidir con un escaneo físico antes de habilitar Cobrar.",
    icon: ShieldCheck,
    accent: "text-emerald-600",
  },
  {
    key: "ubicacion_verificacion_requerida",
    title: "Confirmar ubicación con escaneo",
    description:
      "Activa en este dispositivo el flujo de ubicación + producto para acomodo y reubicación cuando esa operación esté disponible.",
    icon: MapPinCheck,
    accent: "text-violet-600",
  },
  {
    key: "hid_habilitado",
    title: "Pistola USB / Bluetooth",
    description:
      "Permite lectores que trabajan como teclado HID en este dispositivo. Desactívalo aquí si prefieres trabajar sin pistola.",
    icon: Barcode,
    accent: "text-blue-600",
  },
  {
    key: "camara_habilitada",
    title: "Cámara de celular o tablet",
    description:
      "Habilita en este dispositivo el lector por cámara para QR, Code128, EAN, UPC y otros formatos compatibles.",
    icon: Camera,
    accent: "text-cyan-600",
  },
];

export function ScanControlPanel({ config, onChange }: Props) {
  const [savingKey, setSavingKey] = useState<BooleanConfigKey | null>(null);

  const toggle = async (key: BooleanConfigKey, value: boolean) => {
    if (savingKey) return;
    setSavingKey(key);
    const previous = config;
    const optimistic = { ...config, [key]: value };
    onChange(optimistic);

    try {
      const saved = await guardarConfiguracionScan({ [key]: value });
      onChange(saved);
      toast.success("Preferencia guardada solo en este dispositivo.");
    } catch (error) {
      onChange(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la preferencia de escaneo."
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="rn-pos-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black">Control de escaneo</h3>
              <Badge variant="secondary" className="rounded-full">
                Este dispositivo
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              Tú decides cómo trabajar aquí. Estas preferencias se guardan solo
              para tu usuario en este dispositivo y no cambian otras cajas, PCs o celulares.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          No se sincroniza
        </span>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const checked = Boolean(config[item.key]);
          return (
            <div
              key={item.key}
              className="flex min-h-[132px] items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/65">
                  <Icon className={`h-5 w-5 ${item.accent}`} />
                </div>
                <div>
                  <p className="text-sm font-black">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {checked ? "Activo aquí" : "Desactivado aquí"}
                  </p>
                </div>
              </div>
              <Switch
                checked={checked}
                disabled={savingKey !== null}
                onCheckedChange={(value) => void toggle(item.key, value)}
                aria-label={item.title}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
