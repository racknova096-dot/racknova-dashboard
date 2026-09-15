const deployEnvironment = String(import.meta.env.VITE_DEPLOY_ENV || "").trim();
const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
const stagingApiUrl = String(import.meta.env.VITE_PREVIEW_API_URL || "").trim();

const isIsolatedEnvironment =
  deployEnvironment === "preview" || deployEnvironment === "staging";

export const API_URL = isIsolatedEnvironment
  ? stagingApiUrl
  : configuredApiUrl ||
    (import.meta.env.DEV
      ? "http://127.0.0.1:8010"
      : "https://racknova-backend-1.onrender.com");
