import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

// Node ≥25 exposes experimental Web Storage globals. Next's dev overlay
// probes `typeof localStorage !== 'undefined'` then calls getItem without
// a backing file, which throws and 500s every page. Provide a real file
// (absolute path, pre-created) so the API is functional; Node 20/22 has
// no such global, so no flag is needed.
const env = { ...process.env };
if ("localStorage" in globalThis) {
  const storageFile = resolve("./.next/dev-localstorage");
  mkdirSync(resolve("./.next"), { recursive: true });
  if (!existsSync(storageFile)) writeFileSync(storageFile, "");
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--localstorage-file=${storageFile}`]
    .filter(Boolean)
    .join(" ");
}

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});
child.on("exit", (code) => process.exit(code ?? 0));
