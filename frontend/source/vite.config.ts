import { resolve } from "node:path";
import { defineConfig } from "vite";

const htmlEntries = [
  "index.html",
  "404.html",
  "task.html",
  "tagger.html",
  "tageditor.html",
  "tensorboard.html",
  "dreambooth/index.html",
  "lora/index.html",
  "lora/basic.html",
  "lora/master.html",
  "lora/params.html",
  "lora/sdxl.html",
  "lora/flux.html",
  "lora/flux-finetune.html",
  "lora/sd3.html",
  "lora/sd3-finetune.html",
  "lora/tools.html",
  "lora/controlnet.html",
  "lora/sdxl-controlnet.html",
  "lora/flux-controlnet.html",
  "lora/sdxl-lllite.html",
  "lora/ti.html",
  "lora/xti.html",
  "lora/sdxl-ti.html",
  "lora/anima.html",
  "lora/anima-finetune.html",
  "lora/lumina.html",
  "lora/lumina-finetune.html",
  "lora/hunyuan.html",
  "other/about.html",
  "other/settings.html",
];

const input = Object.fromEntries(
  htmlEntries.map((entry) => [entry, resolve(__dirname, entry)])
);

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-dev",
    emptyOutDir: true,
    rollupOptions: {
      input,
    },
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
