import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const esmFile = process.argv[2];
const pkgFile = process.argv[3];
let src = readFileSync(esmFile, "utf8");
const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
const version = pkg.version;

// Replace all package.json reading patterns with hardcoded version
src = src.replace(
  /readFileSync2?\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
  `JSON.stringify({version:"${version}"})`
);
src = src.replace(
  /fs\d+\.readFileSync\(new URL\("[^"]*package\.json",\s*import\.meta\.url\),\s*"utf8"\)/g,
  `JSON.stringify({version:"${version}"})`
);

writeFileSync(esmFile, src);
console.log("Version hardcoded to " + version);
