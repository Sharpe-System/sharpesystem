import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

// List tracked files from git
const out = run("git ls-files");

// Keep just html/htm files (you can expand later)
const files = out
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((p) => p.endsWith(".html") || p.endsWith(".htm"))
  // ignore common noise if you want (optional):
  // .filter((p) => !p.startsWith("node_modules/"))
  .sort((a, b) => a.localeCompare(b));

const payload = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  files
};

const target = "pages.json";
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Wrote ${target} with ${files.length} HTML files.`);
