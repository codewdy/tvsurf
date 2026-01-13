import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "url";
import { resolve } from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  resolve: {
    alias: {
      // bcryptjs 在浏览器中不需要这些 Node.js 模块，提供空对象以避免警告
      path: resolve(__dirname, "./vite-empty-module.ts"),
      crypto: resolve(__dirname, "./vite-empty-module.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9399",
        changeOrigin: true,
      },
      "/resource": {
        target: "http://localhost:9399",
        changeOrigin: true,
      },
    },
  },
});
