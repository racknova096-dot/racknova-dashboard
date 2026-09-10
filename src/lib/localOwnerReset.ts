import { apiFetch, apiJson } from "@/lib/api";

export type LocalOwnerResetStatus = {
  ok: boolean;
  available: boolean;
  runtime: "native_windows";
  role: string;
  confirmation_phrase: string;
  preserves: string[];
};

export type LocalOwnerResetResult = {
  ok: boolean;
  message: string;
  backup_path: string;
  cleared_tables: number;
  node_code: string;
};

export async function obtenerEstadoBorradoLocalPropietario(): Promise<LocalOwnerResetStatus | null> {
  if (typeof window === "undefined") return null;

  try {
    const nativeHealth = await fetch(
      `${window.location.origin}/racknova-native/health`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!nativeHealth.ok) return null;

    const response = await apiFetch("/racknova-native/owner-reset/status", {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LocalOwnerResetStatus;
  } catch {
    return null;
  }
}

export async function borrarDatosLocalesComoPropietario(
  password: string,
  confirmation: string
): Promise<LocalOwnerResetResult> {
  return apiJson<LocalOwnerResetResult>("/racknova-native/owner-reset", {
    method: "POST",
    body: JSON.stringify({
      password,
      confirmation,
    }),
  });
}
