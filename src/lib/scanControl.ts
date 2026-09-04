import { apiJson } from "@/lib/api";

export type RackNovaScanConfig = {
  escaneo_habilitado: boolean;
  pos_verificacion_requerida: boolean;
  ubicacion_verificacion_requerida: boolean;
  hid_habilitado: boolean;
  camara_habilitada: boolean;
  fecha_actualizacion?: string | null;
  actualizado_por?: string | null;
};

export const DEFAULT_SCAN_CONFIG: RackNovaScanConfig = {
  escaneo_habilitado: true,
  pos_verificacion_requerida: false,
  ubicacion_verificacion_requerida: false,
  hid_habilitado: true,
  camara_habilitada: true,
  fecha_actualizacion: null,
  actualizado_por: null,
};

const SCAN_CONFIG_STORAGE_PREFIX = "racknova.scan.preferences.v2";
let memoryConfig: RackNovaScanConfig | null = null;

const currentUserScope = () => {
  if (typeof window === "undefined") return "device";
  try {
    const user = window.localStorage.getItem("usuario")?.trim().toLowerCase();
    return user ? encodeURIComponent(user) : "device";
  } catch {
    return "device";
  }
};

const storageKey = () => `${SCAN_CONFIG_STORAGE_PREFIX}:${currentUserScope()}`;

const normalizeConfig = (value: unknown): RackNovaScanConfig => {
  const input = value && typeof value === "object" ? (value as Partial<RackNovaScanConfig>) : {};
  return {
    escaneo_habilitado:
      typeof input.escaneo_habilitado === "boolean"
        ? input.escaneo_habilitado
        : DEFAULT_SCAN_CONFIG.escaneo_habilitado,
    pos_verificacion_requerida:
      typeof input.pos_verificacion_requerida === "boolean"
        ? input.pos_verificacion_requerida
        : DEFAULT_SCAN_CONFIG.pos_verificacion_requerida,
    ubicacion_verificacion_requerida:
      typeof input.ubicacion_verificacion_requerida === "boolean"
        ? input.ubicacion_verificacion_requerida
        : DEFAULT_SCAN_CONFIG.ubicacion_verificacion_requerida,
    hid_habilitado:
      typeof input.hid_habilitado === "boolean"
        ? input.hid_habilitado
        : DEFAULT_SCAN_CONFIG.hid_habilitado,
    camara_habilitada:
      typeof input.camara_habilitada === "boolean"
        ? input.camara_habilitada
        : DEFAULT_SCAN_CONFIG.camara_habilitada,
    fecha_actualizacion:
      typeof input.fecha_actualizacion === "string"
        ? input.fecha_actualizacion
        : null,
    actualizado_por:
      typeof input.actualizado_por === "string" ? input.actualizado_por : null,
  };
};

const readLocalScanConfig = (): RackNovaScanConfig => {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(storageKey());
      if (raw) {
        const parsed = normalizeConfig(JSON.parse(raw));
        memoryConfig = parsed;
        return parsed;
      }
    } catch {
      // Si el navegador bloquea storage, mantenemos la preferencia en memoria.
    }
  }
  return memoryConfig ? { ...memoryConfig } : { ...DEFAULT_SCAN_CONFIG };
};

const writeLocalScanConfig = (config: RackNovaScanConfig) => {
  memoryConfig = config;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(config));
    window.dispatchEvent(
      new CustomEvent("racknova:scan-config-local", { detail: config })
    );
  } catch {
    // La sesión actual conserva memoryConfig aunque storage no esté disponible.
  }
};

// Preferencias de operación: deliberadamente locales al usuario + dispositivo.
// No se consultan ni se envían al backend y por lo tanto no viajan por Sync.
export const obtenerConfiguracionScan = async () => readLocalScanConfig();

export const guardarConfiguracionScan = async (
  config: Partial<RackNovaScanConfig>
) => {
  const current = readLocalScanConfig();
  const actor =
    typeof window !== "undefined"
      ? window.localStorage.getItem("nombre") ||
        window.localStorage.getItem("usuario") ||
        "Este dispositivo"
      : "Este dispositivo";

  const normalizedPatch = { ...config };
  if (config.escaneo_habilitado === false) {
    normalizedPatch.pos_verificacion_requerida = false;
    normalizedPatch.ubicacion_verificacion_requerida = false;
  }

  const next = normalizeConfig({
    ...current,
    ...normalizedPatch,
    fecha_actualizacion: new Date().toISOString(),
    actualizado_por: actor,
  });

  writeLocalScanConfig(next);
  return next;
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

// Las identidades físicas RNLOC sí pertenecen a la empresa y siguen en backend/Sync.
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
