import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    // one shared DB across integration files → no cross-file parallelism
    fileParallelism: false,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next", "mini-services/**"],
    environment: "node",
    globals: false,
    // 15s (P4) began timing out on FIRST-CONTACT route compiles once P9 added
    // heavy route deps (mammoth/pdfjs) — and whichever test hits a cold route
    // first eats the compile, so per-file warmups can't cover it. 30s covers
    // cold compiles under memory pressure without masking real hangs (hook
    // timeout below stays 60s, and CI's job-level budget is minutes).
    testTimeout: 30000,
    hookTimeout: 60000,
    // Ensure AUTH_SECRET is set BEFORE any test imports src/lib/server/auth.ts
    // (that file throws at module load if SECRET is missing — see ADR-0004)
    // AUTH_SECRET must INHERIT the ambient value instead of hard-overriding it:
    // global-setup forwards process.env.AUTH_SECRET to the ephemeral server, and
    // tests that sign URLs client-side (attachment downloads, ADR-0012) verify
    // against the server's secret — a mismatch here 403s only on CI, where the
    // job env sets its own value (P9 lesson).
    env: {
      AUTH_SECRET:
        process.env.AUTH_SECRET || "test-secret-at-least-32-bytes-long-for-vitest-only",
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
