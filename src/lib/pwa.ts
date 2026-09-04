type InstallOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

export type RackNovaPwaState =
  | "installed"
  | "available"
  | "ios"
  | "browser"
  | "insecure"
  | "unsupported";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersRegistered = false;

const notify = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("racknova:pwa-state"));
};

export function isRackNovaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigatorStandalone
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSecurePwaContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function getRackNovaPwaState(): RackNovaPwaState {
  if (typeof window === "undefined") return "unsupported";
  if (isRackNovaStandalone()) return "installed";
  if (!isSecurePwaContext()) return "insecure";
  if (deferredPrompt) return "available";
  if (isIosDevice()) return "ios";
  if ("serviceWorker" in navigator) return "browser";
  return "unsupported";
}

export async function promptRackNovaInstall(): Promise<
  InstallOutcome | "unavailable"
> {
  if (!deferredPrompt) return "unavailable";

  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();

  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome !== "accepted") {
    notify();
  }

  return choice.outcome;
}

export function registerRackNovaPwa(): void {
  if (typeof window === "undefined" || listenersRegistered) return;
  listenersRegistered = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  if (!("serviceWorker" in navigator) || !isSecurePwaContext()) {
    notify();
    return;
  }

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    const workerUrl = `${baseUrl}sw.js`;

    void navigator.serviceWorker
      .register(workerUrl, { scope: baseUrl })
      .then(() => notify())
      .catch((error) => {
        console.warn("RackNova PWA: no fue posible registrar el service worker.", error);
        notify();
      });
  });
}
