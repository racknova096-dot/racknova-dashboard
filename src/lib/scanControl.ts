import { apiJson } from "@/lib/api";

export type RackNovaScanConfig = {
  pos_verificacion_requerida: boolean;
  ubicacion_verificacion_requerida: boolean;
  hid_habilitado: boolean;
  camara_habilitada: boolean;
  fecha_actualizacion?: string | null;
  actualizado_por?: string | null;
};

export const DEFAULT_SCAN_CONFIG: RackNovaScanConfig = {
  pos_verificacion_requerida: false,
  ubicacion_verificacion_requerida: false,
  hid_habilitado: true,
  camara_habilitada: true,
  fecha_actualizacion: null,
  actualizado_por: null,
};

export type RackNovaLocationIdentity = {
  id_ubicacion: string;
  codigo_ubicacion: string;
  nombre: string;
  rack?: string | null;
  nivel?: string | null;
  posicion?: string | null;
  descripcion?: string | null;
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  creado_por: string;
  actualizado_por: string;
};

export type RackNovaLocationCreate = {
  nombre: string;
  rack?: string | null;
  nivel?: string | null;
  posicion?: string | null;
  descripcion?: string | null;
};

export const obtenerConfiguracionScan = () =>
  apiJson<RackNovaScanConfig>("/scan/configuracion");

export const guardarConfiguracionScan = (
  config: Partial<RackNovaScanConfig>
) =>
  apiJson<RackNovaScanConfig>("/scan/configuracion", {
    method: "PUT",
    body: JSON.stringify(config),
  });

export const listarUbicacionesScan = (incluirInactivas = false) =>
  apiJson<RackNovaLocationIdentity[]>(
    `/scan/ubicaciones?incluir_inactivas=${incluirInactivas ? "true" : "false"}`
  );

export const crearUbicacionScan = (payload: RackNovaLocationCreate) =>
  apiJson<RackNovaLocationIdentity>("/scan/ubicaciones", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const actualizarUbicacionScan = (
  idUbicacion: string,
  payload: Partial<RackNovaLocationCreate> & { activa?: boolean }
) =>
  apiJson<RackNovaLocationIdentity>(`/scan/ubicaciones/${idUbicacion}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const desactivarUbicacionScan = (idUbicacion: string) =>
  apiJson<{ ok: boolean; id_ubicacion: string }>(
    `/scan/ubicaciones/${idUbicacion}`,
    { method: "DELETE" }
  );
