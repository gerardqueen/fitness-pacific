import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages, the site lives at https://<user>.github.io/<repo>/
// so all assets need to be prefixed with /<repo>/. Set VITE_BASE in the
// build env (or in the GitHub Actions workflow) to control this.
//   - For GitHub Pages at /fitness-pacific/  : VITE_BASE=/fitness-pacific/
//   - For a custom domain (e.g. fitnesspacific.app) : VITE_BASE=/
//   - Local dev (npm run dev) : leave unset, defaults to /
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: "dist",
    sourcemap: false,
    // Keep the bundle a single chunk for simplicity at this scale
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
