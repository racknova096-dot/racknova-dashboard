import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, Loader2, Sparkles } from "lucide-react";

const IA_TIPS = [
  "Pregúntale a RackNova IA qué productos necesitan atención.",
  "RackNova IA puede ayudarte a detectar stock bajo y productos sin movimiento.",
  "Consulta ventas, inventario y oportunidades directamente con RackNova IA.",
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getFriendlyName() {
  if (typeof window === "undefined") return "";

  const raw =
    window.localStorage.getItem("nombre") ||
    window.localStorage.getItem("usuario") ||
    "";

  const clean = raw.trim();
  if (!clean) return "";

  const withoutEmail = clean.includes("@") ? clean.split("@")[0] : clean;
  const first = withoutEmail.split(/\s+/)[0] || withoutEmail;

  return first
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RackNovaStartupScreen({ show }: { show: boolean }) {
  const [tipIndex, setTipIndex] = useState(0);
  const greeting = useMemo(() => getGreeting(), [show]);
  const name = useMemo(() => getFriendlyName(), [show]);
  const iconSrc = `${import.meta.env.BASE_URL}racknova-icon-192-v2.png`;

  useEffect(() => {
    if (!show) {
      setTipIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % IA_TIPS.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden bg-background"
      role="status"
      aria-live="polite"
      aria-label="RackNova está preparando el sistema"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.08),transparent_34%)]" />
      <div className="absolute left-1/2 top-[-12rem] h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex min-h-full items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-2xl shadow-primary/10 sm:h-28 sm:w-28 sm:rounded-[32px]">
            <img
              src={iconSrc}
              alt="RackNova"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            RackNova está despertando
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl md:text-5xl">
            {greeting}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Estamos preparando tu inventario para que puedas continuar justo donde lo dejaste.
          </p>

          <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-border/70 bg-card/80 p-4 text-left shadow-xl shadow-black/5 backdrop-blur sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">
                  Cargando inventario y movimientos
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  RackNova habilitará las acciones en cuanto termine de preparar tus datos.
                </p>
              </div>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            </div>
          </div>

          <div className="mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-3xl border border-primary/15 bg-primary/[0.045] p-4 text-left sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                Mientras tanto, recuerda RackNova IA
              </p>
              <p className="mt-1.5 text-sm leading-6 text-foreground/80">
                {IA_TIPS[tipIndex]}
              </p>
            </div>
          </div>

          <div className="mx-auto mt-7 flex w-32 items-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 flex-1 animate-pulse rounded-full bg-primary/30" />
            <span className="h-1.5 flex-1 animate-pulse rounded-full bg-primary/55 [animation-delay:180ms]" />
            <span className="h-1.5 flex-1 animate-pulse rounded-full bg-primary [animation-delay:360ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
