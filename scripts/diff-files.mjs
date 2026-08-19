import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = "/home/daytona/codebase";
const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "velnox-mvp", ".next", ".turbo", "coverage", ".vite"]);
const EXCLUDE_FILES = new Set(["push-velnox.mjs", "diff-files.mjs"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      out.push(...walk(full));
    } else {
      if (EXCLUDE_FILES.has(name)) continue;
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

const local = new Set(walk(ROOT).map((p) => p.split("\\").join("/")));

import { readFileSync } from "fs";
const remoteData = JSON.parse(readFileSync("/tmp/rtree.json", "utf8"));
const remote = new Set(remoteData.tree.filter((t) => t.type === "blob").map((t) => t.path));

console.log("local:", local.size, "remote:", remote.size);
const onlyRemote = [...remote].filter((p) => !local.has(p)).sort();
const onlyLocal = [...local].filter((p) => !remote.has(p)).sort();

console.log("\n=== ONLY IN REMOTE ===", onlyRemote.length);
for (const p of onlyRemote) console.log("  ", p);
console.log("\n=== ONLY IN WORKSPACE ===", onlyLocal.length);
for (const p of onlyLocal) console.log("  ", p);
