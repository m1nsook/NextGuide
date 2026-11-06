import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "#read-file": fileURLToPath(new URL("./src/openapi/load/read-file.node.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
