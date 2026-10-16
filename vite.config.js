import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Let the bundler keep editor dependencies behind their lazy routes.
  // A forced editor group pulled shared dependencies into the login preload.
});
