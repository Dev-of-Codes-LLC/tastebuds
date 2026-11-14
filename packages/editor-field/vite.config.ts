// Build the field as one JavaScript file and one stylesheet, for a page
// that uses no bundler:  npm run build:field
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("."),
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
    lib: {
      entry: here("src/bundle.ts"),
      formats: ["es"],
      fileName: () => "editor-field.js",
      cssFileName: "editor-field",
    },
  },
});
