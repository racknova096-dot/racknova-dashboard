import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getStoredName() {
  if (typeof window === "undefined") return "";

  const savedName = window.localStorage.getItem("nombre")?.trim();
  if (savedName) return savedName;

  const user = window.localStorage.getItem("usuario")?.trim();
  if (!user) return "";

  const raw = user.includes("@") ? user.split("@", 1)[0] : user;
  return raw
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const loadingMessages = [
  "Preparando tu inventario...",
  "Cargando productos y movimientos...",
  "Organizando la información de RackNova...",
];

export function RackNovaStartupLoader({ show }: { show: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);

  const userName = useMemo(() => getStoredName(), []);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const iconUrl = `${import.meta.env.BASE_URL}racknova-icon-192-v2.png`;

  useEffect(() => {
    if (!show) {
      setMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 1300);

    return () => window.clearInterval(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_36%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl shadow-orange-950/30 sm:h-28 sm:w-28">
          <img
            src={iconUrl}
            alt="RackNova"
            className="h-full w-full object-cover"
          />
        </div>

        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-400">
          RackNova
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {greeting}{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
          Estamos preparando RackNova para ti. Tu información estará lista en un momento.
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-left shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Cargando
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {loadingMessages[messageIndex]}
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300" />
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-md items-start gap-3 rounded-2xl border border-orange-400/15 bg-orange-400/[0.07] p-4 text-left">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm font-bold text-orange-100">No olvides RackNova IA</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Pregúntale por stock bajo, ventas, productos que necesitan atención o decisiones de inventario.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] font-medium tracking-wide text-slate-500">
          La pantalla se cerrará automáticamente en cuanto tus datos estén listos.
        </p>
      </div>
    </div>
  );
}
