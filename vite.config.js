import { createHash } from "node:crypto";
import fs from "node:fs";
import { defineConfig } from "vitest/config";

// Writes dist/sw.js from src/sw.js with the real list of built files, so the game works offline.
const offline = () => ({
  name: "inkfall-offline",
  apply: "build",
  generateBundle(_options, bundle) {
    // The .woff files are fallbacks for old browsers; those browsers have no service worker anyway.
    const built = Object.keys(bundle).filter((name) => !name.endsWith(".woff"));
    const files = ["./", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", ...built];
    const version = createHash("sha1").update(files.join("|")).digest("hex").slice(0, 10);
    const source = fs
      .readFileSync(new URL("./src/sw.js", import.meta.url), "utf8")
      .replace("__FILES__", JSON.stringify(files))
      .replace("__VERSION__", version);
    this.emitFile({ type: "asset", fileName: "sw.js", source });
  },
});

export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  server: { host: true }, // so a phone on the same network can open the dev server
  plugins: [offline()],
  test: { include: ["tests/**/*.test.js"] },
});
