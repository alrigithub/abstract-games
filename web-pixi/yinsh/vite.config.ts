import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [],
  root: ".",
  publicDir: "public",
  build: {
    outDir: path.resolve(__dirname, "../../web/yinsh-pixi"),
    emptyOutDir: true,
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
  },
});
