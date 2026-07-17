import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    fileParallelism: false,
    exclude: ["QA/tests/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
