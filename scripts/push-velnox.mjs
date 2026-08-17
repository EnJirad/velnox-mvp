const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "EnJirad/velnox";
const BRANCH = "main";
const ROOT = "/home/daytona/codebase";

if (!TOKEN) {
  console.error("GITHUB_TOKEN env is required");
  process.exit(1);
}

import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "velnox-mvp", ".next", ".turbo", "coverage", ".vite"]);
const EXCLUDE_FILES = new Set([".env.local", ".env", "push-velnox.mjs"]);

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
      out.push(full);
    }
  }
  return out;
}

const api = "https://api.github.com";
async function gh(method, path, body) {
  const res = await fetch(api + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const files = walk(ROOT);
console.log(`Files to push: ${files.length}`);

const treeItems = [];
let done = 0;
const queue = [...files];

async function pushBlob(file) {
  const content = readFileSync(file);
  const data = await gh("POST", `/repos/${REPO}/git/blobs`, { content: content.toString("base64"), encoding: "base64" });
  treeItems.push({ path: relative(ROOT, file).split("\\").join("/"), mode: "100644", type: "blob", sha: data.sha });
}

async function worker() {
  while (queue.length) {
    const f = queue.shift();
    try {
      await pushBlob(f);
    } catch (e) {
      console.error("FAILED:", f, e.message);
      process.exit(1);
    }
    done++;
    if (done % 100 === 0) console.log(`blobs: ${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
console.log(`blobs done: ${done}/${files.length}`);

const tree = await gh("POST", `/repos/${REPO}/git/trees`, { tree: treeItems });
console.log("tree:", tree.sha);

const now = new Date();
const commit = await gh("POST", `/repos/${REPO}/git/commits`, {
  message: "chore: Velnox MVP - VelShop/VelSeller/VelCenter + Convex backend snapshot",
  author: { name: "EnJirad", email: "130825937+EnJirad@users.noreply.github.com", date: now.toISOString() },
  committer: { name: "EnJirad", email: "130825937+EnJirad@users.noreply.github.com", date: now.toISOString() },
  tree: tree.sha,
});
console.log("commit:", commit.sha);

const ref = await gh("POST", `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
console.log("ref:", ref.ref, "->", ref.object.sha);
console.log("PUSH OK -> https://github.com/EnJirad/velnox/tree/main");
