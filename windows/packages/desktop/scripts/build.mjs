import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

mkdirSync(join(dist, "renderer"), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(dist, "main.js"),
  external: ["electron"],
  packages: "bundle",
});

await esbuild.build({
  entryPoints: [join(root, "src/preload.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(dist, "preload.cjs"),
  external: ["electron"],
});

await esbuild.build({
  entryPoints: [join(root, "src/renderer/app.ts")],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: join(dist, "renderer/app.js"),
});

cpSync(join(root, "src/renderer/index.html"), join(dist, "renderer/index.html"));
cpSync(join(root, "src/renderer/styles.css"), join(dist, "renderer/styles.css"));

console.log("desktop build ok");
