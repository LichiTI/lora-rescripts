import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-dev",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:28000",
        changeOrigin: true,
      },
    },
  },
});
