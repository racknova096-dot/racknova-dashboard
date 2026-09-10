import { apiJson } from "@/lib/api";

export type LocalOwnerResetStatus = {
  available: boolean;
  runtime: "native_windows";
  is_owner: boolean;
  confirmation_text: string | null;
};

export type LocalOwnerResetResult = {
  ok: boolean;
  message: string;
  backup: string;
  identity_preserved: boolean;
  cloud_link_preserved: boolean;
  tables_cleared: number;
  rows_removed: number;
  details: Record<string, number>;
};

export const obtenerEstadoBorradoLocal = async () => {
  return apiJson<LocalOwnerResetStatus>(
    "/racknova-native/owner-reset/status",
    { cache: "no-store" }
  );
};

export const borrarBaseLocal = async ({
  password,
  confirmation,
}: {
  password: string;
  confirmation: string;
}) => {
  return apiJson<LocalOwnerResetResult>("/racknova-native/owner-reset", {
    method: "POST",
    body: JSON.stringify({ password, confirmation }),
  });
};
