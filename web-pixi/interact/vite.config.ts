import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "demo"),
  publicDir: false,
  server: {
    host: "127.0.0.1",
    port: 5175,
  },
  preview: {
    host: "127.0.0.1",
    port: 4175,
  },
  resolve: {
    alias: {
      "@abstract/pixi-interact": path.resolve(__dirname, "src"),
    },
  },
});
