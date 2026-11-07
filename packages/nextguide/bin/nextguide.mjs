#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { initDeveloper } from "../lib/init.mjs";
import { initAccount } from "../lib/account-starter.mjs";
import { rotateBootstrap } from "../lib/account-auth.mjs";
import { upgradeDeveloper } from "../lib/upgrade.mjs";
import { pageCommand } from "../lib/page-cli.mjs";
import { versionCommand } from "../lib/version-cli.mjs";
import { cliUi } from "../lib/cli-ui.mjs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const help = `NextGuide ${version} — early alpha

Usage:
  nextguide --help             Show this help
  nextguide --version          Show installed package version (offline)
  nextguide version check      Check npm latest version on demand
  nextguide version check --tag alpha  Check the alpha channel
  nextguide doctor [path]      Inspect a local Next.js project
  nextguide doctor --json      Print machine-readable diagnostics
  nextguide init [path]        Scaffold documentation in a Next.js project
  nextguide init --account     Set up passwordless Account Mode with a terminal token\n  nextguide init --developer   Use file-first Developer Mode (static export supported)
  nextguide account token --rotate  Replace a lost setup token before owner enrollment
  nextguide init --router app  Select App Router when both routers exist
  nextguide init --base-path /docs  Use /docs as documentation path (default)
  nextguide init --base-path /     Use documentation as website homepage
  nextguide init --replace-home    Back up an existing homepage for root install
  nextguide init --yes             Use defaults noninteractively
  nextguide init --dry-run     Preview files without writing
  nextguide init --dark --accent:purple  Choose default theme and accessible accent
  nextguide init --light|--dark|--system  Set default color mode (light by default)
  nextguide upgrade [path]     Safely migrate existing Developer Mode configuration
  nextguide upgrade --dry-run  Preview changes with no writes
  nextguide upgrade --refresh-generated  Back up and refresh NextGuide-owned files
  nextguide page add <slug>   Create MDX page and update navigation
  nextguide page --help       Show page creation options

Next.js is mandatory. NextGuide aims to support App Router and Pages Router.
Developer Mode is available. Account Mode offers a server-based authenticator setup and protected dashboard.
Docs: https://m1nsook.github.io/NextGuide/
`;

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readPackageJson(path) {
  try {
    return JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export function inspectProject(projectDirectory) {
  const directory = resolve(projectDirectory);
  const pkg = readPackageJson(directory);
  const dependencyVersion = pkg && (
    pkg.dependencies?.next ?? pkg.devDependencies?.next ?? pkg.peerDependencies?.next
  );
  const routers = [];
  for (const [folder, name] of [
    ["app", "App Router"],
    ["src/app", "App Router"],
    ["pages", "Pages Router"],
    ["src/pages", "Pages Router"],
  ]) {
    if (isDirectory(join(directory, folder))) {
      routers.push({ name, folder });
    }
  }

  const issues = [];
  if (!pkg) issues.push("No readable package.json found in the project directory.");
  if (pkg && !dependencyVersion) issues.push("Next.js is not declared in dependencies, devDependencies, or peerDependencies.");
  if (!routers.length) issues.push("No app/, src/app/, pages/, or src/pages/ directory found.");

  return {
    projectDirectory: directory,
    packageName: pkg?.name ?? null,
    nextVersion: dependencyVersion ?? null,
    routers,
    ok: issues.length === 0,
    issues,
  };
}

function doctor(args) {
  const json = args.includes("--json");
  const paths = args.filter((x) => x !== "--json");
  if (paths.some((x) => x.startsWith("-")) || paths.length > 1) {
    process.stderr.write("Usage: nextguide doctor [path] [--json]\n");
    process.exitCode = 2;
    return;
  }
  const result = inspectProject(paths[0] ?? process.cwd());
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    cliUi.heading("NextGuide doctor", "v" + version);
    cliUi.field("Project:", result.projectDirectory);
    if (result.packageName) cliUi.field("Package:", result.packageName);
    if (result.nextVersion) cliUi.field("Next.js:", result.nextVersion);
    for (const router of result.routers) cliUi.field("Router:", router.name + " (" + router.folder + "/)");
    if (result.issues.length) for (const issue of result.issues) cliUi.fail("ERROR: " + issue);
    else cliUi.success("OK: Next.js and a supported router directory were detected.");
    cliUi.note("Account Mode requires App Router and a persistent Next.js server; Developer Mode also supports static export.");
  }
  if (!result.ok) process.exitCode = 1;
}


async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(cliUi.prompt(question))).trim().toLowerCase(); }
  finally { rl.close(); }
}

async function init(args) {
  let projectPath;
  let router;
  let basePath;
  let replaceHome = false;
  let yes = false;
  let dryRun = false;
  let mode = "developer";
  let explicitMode = false;
  const appearance = {};
  const chosenModes = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--developer") { mode = "developer"; explicitMode = true; }
    else if (arg === "--account") { mode = "account"; explicitMode = true; }
    else if (arg === "--mode" && args[index + 1]) { mode = args[++index]; explicitMode = true; }
    else if (arg === "--router" && args[index + 1]) router = args[++index];
    else if (arg === "--base-path" && args[index + 1]) basePath = args[++index];
    else if (["--light", "--dark", "--system"].includes(arg)) {
      appearance.mode = arg.slice(2);
      chosenModes.add(appearance.mode);
    }
    else if (arg.startsWith("--accent:")) appearance.accent = arg.slice("--accent:".length);
    else if (arg === "--accent" && args[index + 1]) appearance.accent = args[++index];
    else if (arg === "--replace-home") replaceHome = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--yes") yes = true;
    else if (!arg.startsWith("-") && !projectPath) projectPath = arg;
    else {
      process.stderr.write("Invalid init argument: " + arg + "\n");
      process.exitCode = 2;
      return;
    }
  }
  if (chosenModes.size > 1) {
    process.stderr.write("Choose one color mode: --light, --dark or --system.\n");
    process.exitCode = 2;
    return;
  }
  if (!["developer", "account"].includes(mode)) {
    process.stderr.write("Invalid mode. Choose --developer or --account.\n");
    process.exitCode = 2;
    return;
  }
  if (router && router !== "app" && router !== "pages") {
    process.stderr.write("Invalid router. Use --router app or --router pages.\n");
    process.exitCode = 2;
    return;
  }
  if (basePath && basePath !== "/" && basePath !== "/docs") {
    process.stderr.write("Invalid documentation location. Use --base-path / or --base-path /docs.\n");
    process.exitCode = 2;
    return;
  }
  const directory = projectPath ?? process.cwd();
  // Existing installations should be upgraded, not reinitialized. Detect them
  // before asking for a new mode or mount path, so an installed site never gets
  // a confusing second-install wizard or a huge file-conflict dump.
  let installedMode;
  let installedBasePath;
  try {
    const existing = JSON.parse(readFileSync(join(directory, "nextguide.config.json"), "utf8"));
    if (existing && ["developer", "account"].includes(existing.mode)) {
      installedMode = existing.mode;
      installedBasePath = existing.basePath ?? "/docs";
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  if (installedMode) {
    const upgradeFlags = [
      ...(appearance.mode ? ["--" + appearance.mode] : []),
      ...(appearance.accent ? ["--accent:" + appearance.accent] : []),
    ];
    process.stderr.write(
      "NextGuide " + installedMode + " Mode is already initialized at " + installedBasePath + ".\n" +
      "Your pages and configuration were not modified.\n"
    );
    if (installedMode === "developer") {
      process.stderr.write("To update this installation, run: nextguide upgrade --refresh-generated" +
        (upgradeFlags.length ? " " + upgradeFlags.join(" ") : "") + "\n");
    } else {
      process.stderr.write("Account Mode is already initialized; do not run init a second time.\n");
    }
    if (basePath && basePath !== installedBasePath) {
      process.stderr.write("Changing from " + installedBasePath + " to " + basePath +
        " is a separate mount-path migration and cannot be done by re-running init.\n");
    }
    process.exitCode = 2;
    return;
  }
  const interactive = !yes && process.stdin.isTTY && process.stdout.isTTY;
  // Existing non-interactive installations preserve Developer Mode to avoid
  // silently introducing server state into CI or scripted docs deployments.
  // New interactive installations recommend browser-first Account Mode.
  if (interactive && !explicitMode) {
    const selected = await ask("Choose a NextGuide mode: [1] Account Mode (recommended, server)  [2] Developer Mode (files/static): ");
    if (selected === "" || selected === "1" || selected === "account") mode = "account";
    else if (selected === "2" || selected === "developer") mode = "developer";
    else {
      process.stderr.write("Invalid mode selection. Choose 1 or 2.\n");
      process.exitCode = 2;
      return;
    }
  }
  if (basePath === undefined && interactive) {
    const selection = await ask("Where should NextGuide documentation appear? [1] /docs (default)  [2] / (homepage): ");
    if (selection === "2" || selection === "/") basePath = "/";
    else if (selection === "" || selection === "1" || selection === "/docs") basePath = "/docs";
    else {
      process.stderr.write("Invalid selection. Choose 1 or 2.\n");
      process.exitCode = 2;
      return;
    }
  }
  basePath ??= "/docs";
  if (replaceHome && basePath !== "/") {
    process.stderr.write("--replace-home is only valid with --base-path /.\n");
    process.exitCode = 2;
    return;
  }
  try {
    const status = inspectProject(directory);
    if (basePath === "/" && interactive && !replaceHome) {
      try {
        initDeveloper(directory, status, { router, basePath, dryRun: true });
      } catch (error) {
        if (!String(error.message).includes("--replace-home")) throw error;
        const approval = await ask("An existing homepage will be backed up before NextGuide takes over /. Continue? [y/N]: ");
        if (approval !== "y" && approval !== "yes") {
          process.stderr.write("Root installation cancelled. Use --base-path /docs to keep the current homepage.\n");
          process.exitCode = 2;
          return;
        }
        replaceHome = true;
      }
    }
    const result = (mode === "account" ? initAccount : initDeveloper)(directory, status, { router, dryRun, basePath, replaceHome, appearance });
    cliUi.heading("NextGuide " + (mode === "account" ? "Account" : "Developer") + " Mode",
      (dryRun ? "preview" : "initialized") + " · v" + version);
    cliUi.field("Project:", result.projectDirectory);
    cliUi.field("Router:", result.router.name + " (" + result.router.folder + ")");
    cliUi.field("Documentation URL:", result.basePath);
    cliUi.field("Appearance:", result.appearance.mode + " / " + result.appearance.accent);
    cliUi.field("Templates:", "installed NextGuide package v" + version);
    for (const name of result.created) cliUi.file(dryRun ? "WOULD CREATE" : "CREATE", name);
    for (const name of result.modified) cliUi.file(dryRun ? "WOULD UPDATE" : "UPDATE", name);
    for (const name of result.backedUp) cliUi.file(dryRun ? "WOULD BACK UP" : "BACKUP", name);
    if (!dryRun && mode === "account") {
      cliUi.blank();
      cliUi.warn("ONE-TIME ACCOUNT SETUP TOKEN (save until enrollment):");
      process.stdout.write(result.bootstrapToken + "\n");
      cliUi.field("Private account storage:", result.privateDirectory);
      cliUi.note("Next: run your Next.js server and open /setup. Never share this token.");
    } else if (!dryRun) {
      cliUi.success("Next: start your existing Next.js dev server and open " + result.basePath + ".");
    }
  } catch (error) {
    cliUi.fail("NextGuide init failed: " + error.message);
    process.exitCode = 1;
  }
}


function upgrade(args) {
  let projectPath;
  let dryRun = false;
  let refreshGenerated = false;
  let router;
  const appearance = {};
  const chosenModes = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--refresh-generated") refreshGenerated = true;
    else if (arg === "--router" && args[index + 1]) router = args[++index];
    else if (["--light", "--dark", "--system"].includes(arg)) {
      appearance.mode = arg.slice(2);
      chosenModes.add(appearance.mode);
    }
    else if (arg.startsWith("--accent:")) appearance.accent = arg.slice("--accent:".length);
    else if (arg === "--accent" && args[index + 1]) appearance.accent = args[++index];
    else if (!arg.startsWith("-") && !projectPath) projectPath = arg;
    else {
      process.stderr.write("Invalid upgrade argument: " + arg + "\n");
      process.exitCode = 2;
      return;
    }
  }
  if (chosenModes.size > 1 || (router && !["app", "pages"].includes(router))) {
    process.stderr.write("Invalid upgrade color mode or router option.\n");
    process.exitCode = 2;
    return;
  }
  const directory = projectPath ?? process.cwd();
  try {
    const result = upgradeDeveloper(directory, inspectProject(directory), { dryRun, refreshGenerated, router, appearance });
    cliUi.heading("NextGuide Developer Mode", (dryRun ? "upgrade preview" : "upgrade complete") + " · v" + version);
    cliUi.field("Project:", result.projectDirectory);
    cliUi.field("Appearance:", result.appearance.mode + " / " + result.appearance.accent);
    cliUi.field("Templates:", "installed NextGuide package v" + version);
    if (!result.changes.length) {
      cliUi.success("All files match the templates in this installed package. No changes were required.");
      if (refreshGenerated) cliUi.note("Refresh does not download or rebuild packages; install a freshly packed archive first.");
    } else {
      for (const change of result.changes) {
        cliUi.file(dryRun ? "WOULD UPDATE" : "UPDATE", change.path);
        if (change.backup) cliUi.backup(change.backup);
      }
      if (!dryRun) cliUi.success("Applied " + result.changes.length + " changes. MDX pages and navigation preserved.");
    }
    if (!refreshGenerated) {
      cliUi.note("To adopt new starter templates: nextguide upgrade --refresh-generated");
      cliUi.note("Generated files are backed up; authored pages are untouched.");
    }
    if (dryRun) cliUi.note("Preview only — no files were modified.");
  } catch (error) {
    cliUi.fail("NextGuide upgrade failed: " + error.message);
    process.exitCode = 1;
  }
}

function accountCommand(args) {
  const values = args.filter(item => item !== "--rotate")
  if (!args.includes("--rotate") || values[0] !== "token" || values.length > 2) {
    process.stderr.write("Usage: nextguide account token --rotate [project]\n")
    process.exitCode = 2
    return
  }
  try {
    const project = values[1] ?? process.cwd()
    const result = rotateBootstrap(project)
    process.stdout.write("NextGuide Account Mode: replacement setup token\n" + result.token + "\n")
    process.stdout.write("The previous token and unfinished QR enrollment are now invalid. Open /setup.\n")
  } catch (error) {
    process.stderr.write("NextGuide account token rotation failed: " + error.message + "\n")
    process.exitCode = 1
  }
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case undefined:
  case "--help":
  case "-h":
  case "help":
    cliUi.heading("NextGuide", "v" + version);
    process.stdout.write(help);
    break;
  case "--version":
  case "-v":
    process.stdout.write(`${version}\n`);
    break;
  case "doctor":
    doctor(args);
    break;
  case "init":
    await init(args);
    break;
  case "upgrade":
    upgrade(args);
    break;
  case "page":
    pageCommand(args);
    break;
  case "account":
    accountCommand(args);
    break;
  case "version":
    await versionCommand(args, version);
    break;
  default:
    process.stderr.write(`Unknown NextGuide command: ${command}\nRun 'nextguide --help' to see available commands.\n`);
    process.exitCode = 2;
}
