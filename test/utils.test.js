import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FRAMEWORKS, findFramework, signupUrl, tarballUrl } from "../src/frameworks.js";
import {
  detectPackageManager,
  isEmptyDir,
  nodeSatisfies,
  rewritePackageJson,
  validateName,
} from "../src/utils.js";

test("validateName accepts package-safe names and rejects the rest", () => {
  assert.equal(validateName("my-blog"), undefined);
  assert.equal(validateName("blog.v2"), undefined);
  assert.equal(validateName("sites/my-blog"), undefined);
  assert.match(validateName(""), /Enter a project name/);
  assert.match(validateName("My Blog"), /lowercase/);
  assert.match(validateName("-blog"), /lowercase/);
});

test("isEmptyDir treats a missing or OS-litter-only folder as empty", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ccb-"));
  assert.equal(isEmptyDir(path.join(root, "missing")), true);

  const litter = path.join(root, "litter");
  mkdirSync(litter);
  writeFileSync(path.join(litter, ".DS_Store"), "");
  assert.equal(isEmptyDir(litter), true);

  writeFileSync(path.join(litter, "index.js"), "");
  assert.equal(isEmptyDir(litter), false);
});

test("nodeSatisfies compares major, minor and patch", () => {
  assert.equal(nodeSatisfies("20.9.0", "20.9.0"), true);
  assert.equal(nodeSatisfies("20.9.0", "20.10.0"), true);
  assert.equal(nodeSatisfies("20.9.0", "22.0.0"), true);
  assert.equal(nodeSatisfies("22.12.0", "22.11.9"), false);
  assert.equal(nodeSatisfies("22.12.0", "20.19.0"), false);
});

test("detectPackageManager follows whatever ran the CLI", () => {
  assert.equal(detectPackageManager("pnpm/9.1.0 npm/? node/v22"), "pnpm");
  assert.equal(detectPackageManager("yarn/4.0.0 npm/? node/v22"), "yarn");
  assert.equal(detectPackageManager("bun/1.1.0"), "bun");
  assert.equal(detectPackageManager("npm/10.8.0 node/v22"), "npm");
  assert.equal(detectPackageManager(""), "npm");
});

test("rewritePackageJson renames the project and drops the example's links", () => {
  const pkg = rewritePackageJson(
    {
      name: "nextjs-starter-contioreach",
      version: "1.0.0",
      private: false,
      repository: { type: "git", url: "x" },
      homepage: "x",
      keywords: ["a"],
      scripts: { dev: "next dev" },
    },
    "my-blog",
  );
  assert.deepEqual(pkg, {
    name: "my-blog",
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev" },
  });
});

test("findFramework resolves ids and aliases", () => {
  assert.equal(findFramework("next").id, "next");
  assert.equal(findFramework("Next.js").id, "next");
  assert.equal(findFramework("vite").id, "react");
  assert.equal(findFramework("svelte").id, "sveltekit");
  assert.equal(findFramework("angular"), null);
});

test("every framework points at its starter and tags signups", () => {
  assert.equal(FRAMEWORKS.length, 6);
  for (const fw of FRAMEWORKS) {
    assert.match(tarballUrl(fw), new RegExp(`/contioreach/${fw.repo}/tar.gz/refs/heads/main$`));
    assert.equal(signupUrl(fw), `https://app.contioreach.com/signup?ref=cli&fw=${fw.id}`);
  }
});
