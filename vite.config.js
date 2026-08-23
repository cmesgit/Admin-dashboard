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
  build: {
    rollupOptions: {
      output: {
        // Without this, Rollup groups TipTap/ProseMirror (large — only used by
        // the Blog Editor's rich-text fields) into a shared chunk with
        // whatever small app util happens to be its other importer, and names
        // the file after that util (e.g. a prior build produced a 505 kB
        // "datetimeLocal-*.js" — datetimeLocal.js itself is ~10 lines). The
        // size is inherent to a rich-text editor and the chunk is already
        // lazy (only fetched when BlogEditor's route loads), so this is
        // naming for maintainability, not a size reduction.
        manualChunks(id) {
          if (id.includes("node_modules") && /@tiptap|prosemirror/.test(id)) {
            return "vendor-editor";
          }
        },
      },
    },
  },
});
