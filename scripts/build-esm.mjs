import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "torlink");

// Run esbuild via CLI to avoid ESM import resolution issues on Windows
const args = [
  "src/index.tsx",
  "--bundle",
  "--platform=node",
  "--target=node22",
  "--format=esm",
  "--outfile=dist/torlink.mjs",
  "--jsx=automatic",
  "--jsx-import-source=react",
  "--loader:.tsx=tsx",
  "--loader:.ts=ts",
  '--define:process.env.TORLINK_NO_WEBRTC="1"',
  '--define:process.env.TORLINK_NO_UPDATE_CHECK="1"',
  // Node.js builtins — keep as external requires
  "--external:fs", "--external:path", "--external:os",
  "--external:http", "--external:https", "--external:net",
  "--external:crypto", "--external:events", "--external:stream",
  "--external:url", "--external:util", "--external:child_process",
  "--external:dgram", "--external:dns", "--external:tls",
  "--external:zlib", "--external:querystring", "--external:assert",
  "--external:buffer", "--external:timers", "--external:worker_threads",
  "--external:perf_hooks", "--external:tty", "--external:readline",
  "--external:string_decoder", "--external:module",
  "--external:node:fs", "--external:node:path", "--external:node:os",
  "--external:node:http", "--external:node:https", "--external:node:net",
  "--external:node:crypto", "--external:node:events", "--external:node:stream",
  "--external:node:url", "--external:node:util", "--external:node:child_process",
  "--external:node:dgram", "--external:node:dns", "--external:node:tls",
  "--external:node:zlib", "--external:node:querystring", "--external:node:assert",
  "--external:node:buffer", "--external:node:timers", "--external:node:worker_threads",
  "--external:node:perf_hooks", "--external:node:tty", "--external:node:process",
  "--external:node:module", "--external:fs/promises", "--external:node:fs/promises",
  // Native modules — stub via alias to empty CJS file
  "--alias:node-datachannel=./scripts/empty.js",
  "--alias:utp-native=./scripts/empty.js",
  "--alias:bufferutil=./scripts/empty.js",
  "--alias:utf-8-validate=./scripts/empty.js",
  "--alias:react-devtools-core=./scripts/empty.js",
  "--tree-shaking",
  "--log-level=info",
];

console.log("Running esbuild via CLI...");
execFileSync("esbuild", args, { cwd: root, stdio: "inherit" });

// Hardcode version
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
let esm = readFileSync(resolve(root, "dist/torlink.mjs"), "utf8");
esm = esm.replace(
  /readFileSync2?\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
  `JSON.stringify({version:"${pkg.version}"})`
);
esm = esm.replace(
  /fs\d+\.readFileSync\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
  `JSON.stringify({version:"${pkg.version}"})`
);
writeFileSync(resolve(root, "dist/torlink.mjs"), esm);

const size = readFileSync(resolve(root, "dist/torlink.mjs")).length;
console.log(`ESM bundle: ${(size / 1024).toFixed(0)} KB`);
console.log(`Version hardcoded: ${pkg.version}`);
