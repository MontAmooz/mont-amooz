import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next", "mini-services/**"],
    environment: "node",
    globals: false,
    testTimeout: 15000,
    hookTimeout: 60000,
    // Ensure AUTH_SECRET is set BEFORE any test imports src/lib/server/auth.ts
    // (that file throws at module load if SECRET is missing — see ADR-0004)
    env: {
      AUTH_SECRET: "test-secret-at-least-32-bytes-long-for-vitest-only",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: [
        "src/lib/types.ts",
        "src/lib/constants.ts",
        "src/lib/db.ts",
        "src/lib/server/http.ts",
      ],
      thresholds: {}, // NO thresholds yet — informational only in P4
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
