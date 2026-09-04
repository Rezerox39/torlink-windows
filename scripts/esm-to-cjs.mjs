import { readFileSync, writeFileSync } from "node:fs";

const esmFile = process.argv[2];
const outFile = process.argv[3];

let src = readFileSync(esmFile, "utf8");

// Remove the shebang line
src = src.replace(/^#!.*\n/, "");

const builtins = new Set([
  "fs", "path", "os", "http", "https", "net", "crypto", "events", "stream",
  "url", "util", "child_process", "dgram", "dns", "tls", "zlib", "querystring",
  "assert", "buffer", "timers", "worker_threads", "perf_hooks", "tty",
  "node:fs", "node:path", "node:os", "node:http", "node:https", "node:net",
  "node:crypto", "node:events", "node:stream", "node:url", "node:util",
  "node:child_process", "node:dgram", "node:dns", "node:tls", "node:zlib",
  "node:querystring", "node:assert", "node:buffer", "node:timers",
  "node:worker_threads", "node:perf_hooks", "node:tty", "node:process",
  "node:module", "process", "module", "fs/promises", "node:fs/promises"
]);

function isBuiltin(mod) {
  if (builtins.has(mod)) return true;
  if (mod.startsWith("node:")) return builtins.has(mod.slice(5));
  return false;
}

// Convert ESM "as" alias to CJS ":" alias
// import { readFileSync as readFileSync2 } -> { readFileSync: readFileSync2 }
function fixAliases(imports) {
  return imports.replace(/\bas\b/g, ":");
}

const lines = src.split("\n");
const result = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // import X from "builtin"
  let m = line.match(/^import\s+(\w+)\s+from\s+["']([^"']+)["'];?\s*$/);
  if (m && isBuiltin(m[2])) {
    result.push(`const ${m[1]} = require("${m[2]}");`);
    i++; continue;
  }

  // import * as X from "builtin"
  m = line.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?\s*$/);
  if (m && isBuiltin(m[2])) {
    result.push(`const ${m[1]} = require("${m[2]}");`);
    i++; continue;
  }

  // import { X } from "builtin" (single line)
  m = line.match(/^import\s*\{([^}]+)\}\s*from\s+["']([^"']+)["'];?\s*$/);
  if (m && isBuiltin(m[2])) {
    result.push(`const {${fixAliases(m[1])}} = require("${m[2]}");`);
    i++; continue;
  }

  // import X, { Y } from "builtin" (combined default + named)
  m = line.match(/^import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s+["']([^"']+)["'];?\s*$/);
  if (m && isBuiltin(m[3])) {
    result.push(`const ${m[1]} = require("${m[3]}");`);
    result.push(`const {${fixAliases(m[2])}} = require("${m[3]}");`);
    i++; continue;
  }

  // import { X } from "builtin" (multi-line)
  m = line.match(/^import\s*\{([^}]+)$/);
  if (m) {
    let collected = m[1];
    let j = i + 1;
    while (j < lines.length && !lines[j].includes("}")) {
      collected += " " + lines[j].trim();
      j++;
    }
    if (j < lines.length) {
      const closing = lines[j];
      const fullImports = collected + closing;
      const m2 = fullImports.match(/\{([^}]+)\}\s*from\s+["']([^"']+)["'];?\s*$/);
      if (m2 && isBuiltin(m2[2])) {
        result.push(`const {${fixAliases(m2[1])}} = require("${m2[2]}");`);
        i = j + 1;
        continue;
      }
    }
  }

  // import type { X } from "builtin" — remove
  if (line.match(/^import\s+type\s+\{/)) {
    while (i < lines.length && !lines[i].includes(";") && !lines[i].includes("}")) i++;
    i++; continue;
  }

  // import "builtin" — side-effect
  m = line.match(/^import\s+["']([^"']+)["'];?\s*$/);
  if (m && isBuiltin(m[1])) {
    result.push(`require("${m[1]}");`);
    i++; continue;
  }

  result.push(line);
  i++;
}

src = result.join("\n");

// Phase 2: Remove export keywords
src = src.replace(/^export\s+default\s+/gm, "");
src = src.replace(/^export\s+const\s+/gm, "const ");
src = src.replace(/^export\s+function\s+/gm, "function ");
src = src.replace(/^export\s+class\s+/gm, "class ");
src = src.replace(/^export\s+async\s+/gm, "async ");
src = src.replace(/^export\s+\{/gm, "// export {");
src = src.replace(/^export\s+/gm, "");

// Phase 3: Replace import.meta.url
src = src.replace(/import\.meta\.url/g, 'require("node:url").pathToFileURL(__filename).href');

// Phase 4: Handle top-level await
src = src.replace(/^(\s*)await\s+(init_\w+)\(\);/gm, "$1void $2();");

const header = `#!/usr/bin/env node
"use strict";

// WebRTC stub setup (Node 22.15+)
(function() {
  try {
    var M = require('node:module');
    if (typeof M.registerHooks === 'function') {
      var path = require('node:path');
      var url  = require('node:url');
      var stubUrl = url.pathToFileURL(path.join(__dirname, 'webrtc-stub.mjs')).href;
      M.registerHooks({
        resolve: function(spec, ctx, next) {
          return spec === 'webrtc-polyfill'
            ? { url: stubUrl, shortCircuit: true }
            : next(spec, ctx);
        }
      });
    }
  } catch(e) {}
})();
process.title = "torlink";
`;

writeFileSync(outFile, header + src);
const size = (readFileSync(outFile).length / 1024).toFixed(0);
console.log("CJS bundle written:", outFile, "(" + size + " KB)");
