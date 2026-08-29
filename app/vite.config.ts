import path from "path";
const __dirname = import.meta.dirname;
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";

export default defineConfig({
  plugins: [
    devServer({
      entry: "./api/boot.ts",
    }),
  ],
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      db: path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
