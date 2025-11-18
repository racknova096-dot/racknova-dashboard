import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  // 🔥 LO IMPORTANTE PARA VERCEL
  build: {
    outDir: "dist",
  },

  // 🔥 PARA SOPORTE SPA (todas las rutas → index.html)
  appType: "spa",

  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
