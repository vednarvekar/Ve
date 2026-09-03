import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(import.meta.dirname),
  base: "./", // critical: Electron loads this via file://, not http://,
              // so asset URLs must be relative, not root-absolute
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/renderer"),
    emptyOutDir: true,
  },
});
