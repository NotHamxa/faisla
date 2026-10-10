// Live model benchmark (spends API credit). Run: npx vitest run -c vitest.live.config.ts
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["scripts/**/*.live.ts"],
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 600_000,
  },
});
