const deployEnvironment = String(import.meta.env.VITE_DEPLOY_ENV || "").trim();
const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
const previewApiUrl = String(import.meta.env.VITE_PREVIEW_API_URL || "").trim();

export const API_URL =
  deployEnvironment === "preview"
    ? previewApiUrl
    : configuredApiUrl ||
      (import.meta.env.DEV
        ? "http://127.0.0.1:8010"
        : "https://racknova-backend-1.onrender.com");
