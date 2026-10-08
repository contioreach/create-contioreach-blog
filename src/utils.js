import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/* Small, pure helpers — kept apart from the prompts so they can be tested
   without a terminal. */

export class CliError extends Error {}

// Files a fresh, otherwise-empty folder may already hold.
const HARMLESS = new Set([".DS_Store", "Thumbs.db", ".git"]);

export function isEmptyDir(dir) {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).every((entry) => HARMLESS.has(entry));
}

/* The folder name becomes the package name, so it has to be a valid one:
   lowercase, no spaces, nothing npm would reject. */
export function validateName(input) {
  const name = String(input ?? "").trim();
  if (!name) return "Enter a project name.";

  const base = path.basename(path.resolve(name));
  if (!/^[a-z0-9][a-z0-9._~-]*$/.test(base)) {
    return "Use lowercase letters, numbers, dots and dashes (for example my-blog).";
  }
  if (base.length > 214) return "That name is too long for a package name.";
  return undefined;
}

export function nodeSatisfies(min, current = process.versions.node) {
  const have = current.split(".").map(Number);
  const need = min.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((have[i] ?? 0) !== need[i]) return (have[i] ?? 0) > need[i];
  }
  return true;
}

// Answers with whatever ran the CLI: `pnpm create`, `yarn create`, `bun create` or npx.
export function detectPackageManager(userAgent = process.env.npm_config_user_agent ?? "") {
  for (const pm of ["pnpm", "yarn", "bun"]) {
    if (userAgent.startsWith(`${pm}/`)) return pm;
  }
  return "npm";
}

/* The starter's package.json describes the public example repo. The project
   it becomes is the developer's own, so it takes their name and drops the
   links back to the example. */
export function rewritePackageJson(pkg, name) {
  const { repository, homepage, bugs, keywords, ...rest } = pkg;
  return { ...rest, name, version: "0.1.0", private: true };
}
