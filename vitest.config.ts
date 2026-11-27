import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".claude/**"], // session worktrees live under .claude/worktrees
    environment: "happy-dom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    alias: {
      "@": import.meta.dirname,
    },
  },
});
