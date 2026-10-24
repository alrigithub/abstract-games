import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [],
  root: ".",
  publicDir: "public",
  build: {
    outDir: path.resolve(__dirname, "../../web/gomoku-pixi"),
    emptyOutDir: true,
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    port: 5174,
    host: "127.0.0.1",
  },
  preview: {
    port: 4174,
    host: "127.0.0.1",
  },
});
