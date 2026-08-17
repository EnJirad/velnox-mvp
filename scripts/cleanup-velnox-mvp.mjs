const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "EnJirad/velnox-mvp";
const BRANCH = "main";

if (!TOKEN) {
  console.error("GITHUB_TOKEN env is required");
  process.exit(1);
}

import { readFileSync } from "fs";

const REMOVE = new Set([
  "velnox-mvp/src/convex/_generated/api.d.ts",
  "velnox-mvp/src/convex/_generated/api.js",
  "velnox-mvp/src/convex/_generated/dataModel.d.ts",
  "velnox-mvp/src/convex/_generated/server.d.ts",
  "velnox-mvp/src/convex/_generated/server.js",
  "scripts/push-velnox.mjs",
]);

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

const head = await gh("GET", `/repos/${REPO}/git/ref/heads/${BRANCH}`);
console.log("current HEAD:", head.object.sha);

const commit = await gh("GET", `/repos/${REPO}/git/commits/${head.object.sha}`);
const currentTree = await gh("GET", `/repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`);
const blobs = currentTree.tree.filter((t) => t.type === "blob");
console.log("remote blobs:", blobs.length);

const removed = blobs.filter((t) => REMOVE.has(t.path)).map((t) => t.path);
console.log("removing:", removed.length);
for (const p of removed) console.log("  -", p);

const kept = blobs.filter((t) => !REMOVE.has(t.path)).map((t) => ({ path: t.path, mode: t.mode, type: "blob", sha: t.sha }));

const dotfiles = blobs.filter((t) => t.path.split("/").pop().startsWith(".") && !t.path.endsWith(".example"));
console.log("\ndotfiles in repo (for transparency):");
for (const t of dotfiles) console.log("  -", t.path);

const newTree = await gh("POST", `/repos/${REPO}/git/trees`, { tree: kept });
console.log("new tree:", newTree.sha);

const now = new Date();
const newCommit = await gh("POST", `/repos/${REPO}/git/commits`, {
  message: "chore: remove stale velnox-mvp snapshot and scratch scripts",
  author: { name: "EnJirad", email: "130825937+EnJirad@users.noreply.github.com", date: now.toISOString() },
  committer: { name: "EnJirad", email: "130825937+EnJirad@users.noreply.github.com", date: now.toISOString() },
  tree: newTree.sha,
  parents: [head.object.sha],
});
console.log("new commit:", newCommit.sha);

const ref = await gh("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: newCommit.sha, force: false });
console.log("ref updated:", ref.object.sha);
console.log("DONE -> https://github.com/EnJirad/velnox-mvp");
