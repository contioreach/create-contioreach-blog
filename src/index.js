import { spawn } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { x as extract } from "tar";
import { FRAMEWORKS, findFramework, signupUrl, tarballUrl } from "./frameworks.js";
import {
  CliError,
  detectPackageManager,
  isEmptyDir,
  nodeSatisfies,
  rewritePackageJson,
  validateName,
} from "./utils.js";

const DEFAULT_NAME = "my-blog";
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const HELP = `
  Create a blog wired to ContioReach. It runs on demo content straight away.

  ${pc.bold("Usage")}
    npx create-contioreach-blog [project-name] [options]

  ${pc.bold("Options")}
    --framework <name>  ${FRAMEWORKS.map((fw) => fw.id).join(", ")}
    --no-install        Skip installing dependencies
    -h, --help          Show this help
    -v, --version       Show the version
`;

/* ---- cleanup -------------------------------------------------------------
   Whatever the CLI wrote is removed again if it stops partway — Ctrl+C or a
   failed download — so a retry starts from a clean folder. A folder that was
   already there (empty) is kept; only what went into it is removed. */

let target = null; // { dir, existed }
let spin = null; // the running spinner, which hooks process exit itself
let child = null; // the running install, which must stop before its folder goes

function cleanup() {
  if (!target) return;
  const { dir, existed } = target;
  target = null;
  try {
    if (existed) {
      for (const entry of readdirSync(dir)) {
        rmSync(path.join(dir, entry), { recursive: true, force: true, maxRetries: 3 });
      }
    } else {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  } catch {
    // Best effort: never let cleanup hide the error that caused it.
  }
}

function abort(message = "Cancelled. Nothing was left behind.") {
  spin?.clear();

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    p.cancel(message);
    process.exit(130);
  };

  /* An install still running would keep writing into the folder after it is
     removed, so stop it and wait for it first — but never hang on it. */
  if (child && child.exitCode === null) {
    child.once("close", finish);
    child.kill("SIGTERM");
    setTimeout(finish, 5000).unref();
  } else {
    finish();
  }
}

process.on("SIGINT", () => abort());
process.on("SIGTERM", () => abort());

function answer(value) {
  if (p.isCancel(value)) abort();
  return value;
}

/* ---- steps --------------------------------------------------------------- */

function parseCli(argv) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        framework: { type: "string", short: "f" },
        "no-install": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
    return { ...values, install: !values["no-install"], name: positionals[0] };
  } catch (error) {
    throw new CliError(`${error.message}\n${HELP}`);
  }
}

async function askName(initial) {
  let name = initial;

  for (;;) {
    if (!name) {
      name = interactive
        ? answer(
            await p.text({
              message: "Project name?",
              placeholder: DEFAULT_NAME,
              defaultValue: DEFAULT_NAME,
              validate: (value) => (value ? validateName(value) : undefined),
            }),
          )
        : DEFAULT_NAME;
    }

    const problem = validateName(name);
    if (problem) {
      if (!interactive) throw new CliError(problem);
      p.log.error(problem);
      name = null;
      continue;
    }

    // Never write into a folder that already has files in it.
    if (!isEmptyDir(path.resolve(name))) {
      const message = `The folder ${pc.cyan(name)} already exists and isn't empty.`;
      if (!interactive) throw new CliError(`${message} Pick another name.`);
      p.log.warn(`${message} Pick another name.`);
      name = null;
      continue;
    }

    return name.trim();
  }
}

function frameworkFromFlag(flag) {
  const fw = findFramework(flag);
  if (!fw) {
    throw new CliError(
      `Unknown framework "${flag}". Use one of: ${FRAMEWORKS.map((f) => f.id).join(", ")}.`,
    );
  }
  return fw;
}

async function askFramework(preset) {
  if (preset) {
    p.log.step(`Framework: ${preset.label}`);
    return preset;
  }

  if (!interactive) return FRAMEWORKS[0];

  const id = answer(
    await p.select({
      message: "Which framework?",
      initialValue: FRAMEWORKS[0].id,
      options: FRAMEWORKS.map((fw) => ({ value: fw.id, label: fw.label, hint: fw.hint })),
    }),
  );
  return findFramework(id);
}

function checkNode(fw) {
  if (nodeSatisfies(fw.node)) return;
  throw new CliError(
    `${fw.label} needs Node.js ${fw.node} or newer — you have ${process.versions.node}.\n` +
      "Update Node (https://nodejs.org) and run the command again.",
  );
}

/* Fetched in full before anything touches the disk, so a dropped connection
   leaves nothing behind. The starters are small; holding one in memory is fine. */
async function download(fw) {
  let response;
  try {
    response = await fetch(tarballUrl(fw), { signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new CliError(
      "Couldn't reach GitHub to download the starter. Check your internet connection and try again.",
    );
  }
  if (!response.ok) {
    throw new CliError(
      `GitHub answered ${response.status} for ${fw.repo}. Try again in a moment.`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function unpack(tarball, dir) {
  target = { dir, existed: existsSync(dir) };
  await mkdir(dir, { recursive: true });
  // GitHub wraps the repo in a `<repo>-<branch>/` folder; strip it.
  await pipeline(Readable.from(tarball), extract({ cwd: dir, strip: 1 }));
}

/* The starter's .env.example already holds the demo workspace's read-only key,
   so the env file is a straight copy. REVALIDATION_SECRET stays empty: the
   developer generates it in their own dashboard when they set up the webhook. */
async function writeEnv(fw, dir) {
  const example = path.join(dir, ".env.example");
  if (!existsSync(example)) {
    throw new CliError(`The ${fw.label} starter has no .env.example — please report this.`);
  }
  await copyFile(example, path.join(dir, fw.envFile));
}

async function renamePackage(dir, name) {
  const file = path.join(dir, "package.json");
  const pkg = JSON.parse(await readFile(file, "utf8"));
  await writeFile(file, `${JSON.stringify(rewritePackageJson(pkg, name), null, 2)}\n`);
}

function install(pm, dir) {
  return new Promise((resolve) => {
    child = spawn(pm, ["install"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      // npm/pnpm/yarn are .cmd shims on Windows.
      shell: process.platform === "win32",
      env: { ...process.env, npm_config_fund: "false", npm_config_audit: "false" },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => resolve({ ok: false, output: error.message }));
    child.on("close", (code) => {
      child = null;
      resolve({ ok: code === 0, output });
    });
  });
}

/* ---- main ---------------------------------------------------------------- */

export async function main(argv = process.argv.slice(2)) {
  const args = parseCli(argv);

  if (args.help) return console.log(HELP);
  if (args.version) {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    return console.log(pkg.version);
  }

  console.log();
  p.intro(pc.bgMagenta(pc.black(" create-contioreach-blog ")));

  // Checked up front so a typo in --framework fails before any question.
  const preset = args.framework ? frameworkFromFlag(args.framework) : null;

  const name = await askName(args.name);
  const fw = await askFramework(preset);
  checkNode(fw);

  const dir = path.resolve(name);
  const pm = detectPackageManager();
  spin = p.spinner();

  spin.start(`Downloading the ${fw.label} starter`);
  try {
    await unpack(await download(fw), dir);
  } catch (error) {
    spin.error("Download failed");
    throw error;
  }
  spin.stop("Starter downloaded");

  await writeEnv(fw, dir);
  await renamePackage(dir, path.basename(dir));
  p.log.success(`Demo API key added to ${fw.envFile}`);

  if (existsSync(path.join(dir, fw.revalidateRoute))) {
    p.log.success(`Revalidation route ready: ${fw.revalidateRoute}`);
  }

  // From here on the project is complete: an install failure keeps it.
  let installed = false;
  if (args.install) {
    spin.start(`Installing dependencies with ${pm}`);
    const result = await install(pm, dir);
    if (result.ok) {
      installed = true;
      spin.stop("Dependencies installed");
    } else {
      target = null;
      spin.error("Dependency install failed — your project is kept");
      const tail = result.output.trim().split("\n").slice(-12).join("\n");
      if (tail) p.log.message(pc.dim(tail));
    }
  }
  target = null;

  const cd = path.relative(process.cwd(), dir);
  const steps = [
    cd && `cd ${cd.includes(" ") ? `"${cd}"` : cd}`,
    !installed && `${pm} install`,
    `${pm} run dev   ${pc.dim("→")} ${pc.cyan(fw.devUrl)}`,
  ].filter(Boolean);
  p.note(steps.join("\n"), "Next");

  p.log.info(
    [
      "You're on demo content. To use your own posts:",
      `  1. Sign up free: ${pc.cyan(signupUrl(fw))}`,
      `  2. Copy your API key into ${pc.bold(fw.envFile)}`,
    ].join("\n"),
  );
  p.outro("Happy publishing!");
}

export async function run() {
  try {
    await main();
  } catch (error) {
    cleanup();
    if (error instanceof CliError) {
      p.log.error(error.message);
    } else {
      p.log.error(`Something went wrong: ${error?.stack ?? error}`);
    }
    process.exit(1);
  }
}
