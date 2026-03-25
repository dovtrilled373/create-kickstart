import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    timeout: 60000, // scaffold commands can be slow
  },
});
