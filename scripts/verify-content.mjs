import { readFileSync } from "fs";
import { createHash } from "crypto";

const ROOT = "/home/daytona/codebase";
const remoteData = JSON.parse(readFileSync("/tmp/rtree.json", "utf8"));
const remoteByPath = new Map(remoteData.tree.filter((t) => t.type === "blob").map((t) => [t.path, t.sha]));

function localBlobSha(path) {
  const content = readFileSync(path);
  const header = `blob ${content.length}\0`;
  return createHash("sha1").update(header).update(content).digest("hex");
}

const keyFiles = [
  "backend/addresses.ts",
  "backend/validation.ts",
  "convex/customer.ts",
  "convex/auth_redirect.ts",
  "apps/shop/src/pages/ShopAddresses.tsx",
  "tests/addresses.test.ts",
  "apps/shop/src/pages/ShopHome.tsx",
  "packages/shared/src/lib/commerce.ts",
  "docs/VELSHOP_REDESIGN_REPORT.md",
  "package.json",
];

let allMatch = true;
for (const f of keyFiles) {
  const remoteSha = remoteByPath.get(f);
  const localSha = localBlobSha(`${ROOT}/${f}`);
  const ok = remoteSha === localSha;
  if (!ok) allMatch = false;
  console.log(`${ok ? "MATCH    " : "DIFFERS  "} ${f}`);
  if (!ok) console.log(`    remote: ${remoteSha}\n    local : ${localSha}`);
}
console.log(allMatch ? "\nALL KEY FILES MATCH REMOTE" : "\nSOME FILES DIFFER");
