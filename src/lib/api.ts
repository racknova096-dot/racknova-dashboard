import { API_URL } from "@/config";

const clearSessionAndRedirect = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("nombre");
  localStorage.removeItem("rol");

  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
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
