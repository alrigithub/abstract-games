import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [],
  root: ".",
  publicDir: "public",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src"),
      "pixi.js": path.resolve(__dirname, "node_modules/pixi.js"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../web/tak-pixi"),
    emptyOutDir: true,
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5174,
    host: "127.0.0.1",
  },
  preview: {
    port: 4174,
    host: "127.0.0.1",
  },
});
