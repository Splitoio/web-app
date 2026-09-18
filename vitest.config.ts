import { defineConfig } from "vitest/config";

// Minimal Vitest setup for app/ (there was no test runner here before #32): plain node
// environment, only picks up *.test.ts(x) files. Not a testing-strategy overhaul.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
