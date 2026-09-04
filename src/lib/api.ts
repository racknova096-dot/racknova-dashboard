import { API_URL } from "@/config";

const clearSessionAndRedirect = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("nombre");
  localStorage.removeItem("rol");

  if (window.location.pathname !== "/login") {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  }
};

export const getAuthToken = () => {
  return localStorage.getItem("access_token");
};

export const getAuthHeaders = () => {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const emitProductSaved = async (endpoint: string, options: RequestInit, response: Response) => {
  if (
    typeof window === "undefined" ||
    endpoint !== "/productos" ||
    String(options.method || "GET").toUpperCase() !== "POST" ||
    !response.ok
  ) {
    return;
  }

  try {
    const saved = await response.clone().json();
    let requestData: Record<string, unknown> = {};
    if (typeof options.body === "string") {
      requestData = JSON.parse(options.body);
    }
    window.dispatchEvent(
      new CustomEvent("racknova:product-saved", {
        detail: {
          sku: String(saved?.sku || requestData.sku || ""),
          nombre: String(saved?.nombre || requestData.nombre || ""),
          costo_proveedor: Number(
            requestData.costo_proveedor ?? saved?.costo_proveedor ?? 0
          ),
        },
      })
    );
  } catch (error) {
    console.warn("RackNova: no se pudo emitir product-saved", error);
  }
};

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hasBody = Boolean(options.body);
  const isFormData = options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSessionAndRedirect();
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  void emitProductSaved(endpoint, options, response);

  return response;
};

export const apiJson = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await apiFetch(endpoint, options);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "Error en la solicitud.");
  }

  return data as T;
};
