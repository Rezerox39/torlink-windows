import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "torlink");

// Native modules that cannot be loaded from pkg's snapshot filesystem.
// We stub them with empty modules so the app degrades gracefully:
// - node-datachannel: WebRTC (TORLINK_NO_WEBRTC=1 already disables this)
// - utp-native: uTP transport (webtorrent falls back to TCP)
// - bufferutil: ws performance optimization (optional)
// - utf-8-validate: ws performance optimization (optional)
// - react-devtools-core: dev only (never needed in production)
const NATIVE_STUBS = [
  "node-datachannel",
  "node-datachannel/dist",
  "node-datachannel/dist/cjs",
  "node-datachannel/dist/cjs/lib",
  "utp-native",
  "bufferutil",
  "utf-8-validate",
  "react-devtools-core",
];

const stubPlugin = {
  name: "stub-native-modules",
  setup(build) {
    for (const mod of NATIVE_STUBS) {
      const filter = new RegExp(
        "^" + mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(/.*)?$"
      );
      build.onResolve({ filter }, (args) => ({
        path: args.path,
        namespace: "native-stub",
      }));
    }
    build.onLoad({ filter: /.*/, namespace: "native-stub" }, () => ({
      contents: "module.exports = {}; module.exports.default = {};",
      loader: "js",
    }));
  },
};

async function main() {
  const outDir = resolve(root, "dist");

  console.log("Bundling torlink to ESM with native module stubs...");
  await build({
    entryPoints: [resolve(root, "src/index.tsx")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outfile: resolve(outDir, "torlink.mjs"),
    plugins: [stubPlugin],
    jsx: "automatic",
    jsxImportSource: "react",
    define: {
      "process.env.TORLINK_NO_WEBRTC": '"1"',
      "process.env.TORLINK_NO_UPDATE_CHECK": '"1"',
    },
    // Only externalize Node.js builtins — everything else gets bundled
    external: [
      "fs", "path", "os", "http", "https", "net", "crypto", "events", "stream",
      "url", "util", "child_process", "dgram", "dns", "tls", "zlib",
      "querystring", "assert", "buffer", "timers", "worker_threads",
      "perf_hooks", "tty", "readline", "string_decoder", "module",
      "node:fs", "node:path", "node:os", "node:http", "node:https", "node:net",
      "node:crypto", "node:events", "node:stream", "node:url", "node:util",
      "node:child_process", "node:dgram", "node:dns", "node:tls", "node:zlib",
      "node:querystring", "node:assert", "node:buffer", "node:timers",
      "node:worker_threads", "node:perf_hooks", "node:tty", "node:process",
      "node:module", "fs/promises", "node:fs/promises",
    ],
    treeShaking: true,
    logLevel: "info",
  });

  // Hardcode version
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  let esm = readFileSync(resolve(outDir, "torlink.mjs"), "utf8");
  esm = esm.replace(
    /readFileSync2?\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
    `JSON.stringify({version:"${pkg.version}"})`
  );
  esm = esm.replace(
    /fs\d+\.readFileSync\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
    `JSON.stringify({version:"${pkg.version}"})`
  );
  writeFileSync(resolve(outDir, "torlink.mjs"), esm);

  const size = readFileSync(resolve(outDir, "torlink.mjs")).length;
  console.log(`ESM bundle: ${(size / 1024).toFixed(0)} KB`);
  console.log(`Version hardcoded: ${pkg.version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
