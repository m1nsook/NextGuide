#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { initDeveloper } from "../lib/init.mjs";
import { pageCommand } from "../lib/page-cli.mjs";
import { versionCommand } from "../lib/version-cli.mjs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const help = `NextGuide ${version} — early alpha

Usage:
  nextguide --help             Show this help
  nextguide --version          Show installed package version (offline)
  nextguide version check      Check npm latest version on demand
  nextguide version check --tag alpha  Check the alpha channel
  nextguide doctor [path]      Inspect a local Next.js project
  nextguide doctor --json      Print machine-readable diagnostics
  nextguide init [path]        Scaffold Developer Mode in a Next.js project
  nextguide init --router app  Select App Router when both routers exist
  nextguide init --dry-run     Preview files without writing
  nextguide page add <slug>   Create MDX page and update navigation
  nextguide page --help       Show page creation options

Next.js is mandatory. NextGuide aims to support App Router and Pages Router.
Developer Mode initialization is available. Account Mode, /setup and /admin are not yet implemented.
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
    process.stdout.write(`NextGuide doctor ${version}\nProject: ${result.projectDirectory}\n`);
    if (result.packageName) process.stdout.write(`Package: ${result.packageName}\n`);
    if (result.nextVersion) process.stdout.write(`Next.js: ${result.nextVersion}\n`);
    if (result.routers.length) {
      for (const router of result.routers) {
        process.stdout.write(`Router: ${router.name} (${router.folder}/)\n`);
      }
    }
    if (result.issues.length) {
      for (const issue of result.issues) process.stderr.write(`ERROR: ${issue}\n`);
    } else {
      process.stdout.write("OK: Next.js and a supported router directory were detected.\n");
    }
    process.stdout.write("Note: Account Mode, /setup and /admin are not yet implemented. Developer Mode init is available.\n");
  }
  if (!result.ok) process.exitCode = 1;
}


function init(args) {
  let projectPath;
  let router;
  let dryRun = false;
  let mode = "developer";
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--developer") mode = "developer";
    else if (arg === "--account") mode = "account";
    else if (arg === "--mode" && args[index + 1]) mode = args[++index];
    else if (arg === "--router" && args[index + 1]) router = args[++index];
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--yes") { /* noninteractive by default */ }
    else if (!arg.startsWith("-") && !projectPath) projectPath = arg;
    else {
      process.stderr.write("Invalid init argument: " + arg + "\n");
      process.exitCode = 2;
      return;
    }
  }
  if (mode !== "developer") {
    process.stderr.write("Account Mode is not implemented. Use nextguide init --developer for the file-first, static-capable mode.\n");
    process.exitCode = 2;
    return;
  }
  if (router && router !== "app" && router !== "pages") {
    process.stderr.write("Invalid router. Use --router app or --router pages.\n");
    process.exitCode = 2;
    return;
  }
  const directory = projectPath ?? process.cwd();
  try {
    const status = inspectProject(directory);
    const result = initDeveloper(directory, status, { router, dryRun });
    process.stdout.write("NextGuide Developer Mode " + (dryRun ? "preview" : "initialized") + "\n");
    process.stdout.write("Project: " + result.projectDirectory + "\n");
    process.stdout.write("Router: " + result.router.name + " (" + result.router.folder + ")\n");
    for (const name of result.created) process.stdout.write("  " + (dryRun ? "WOULD CREATE" : "CREATE") + " " + name + "\n");
    for (const name of result.modified) process.stdout.write("  " + (dryRun ? "WOULD UPDATE" : "UPDATE") + " " + name + "\n");
    if (!dryRun) process.stdout.write("Next: start your existing Next.js dev server and open /docs.\n");
  } catch (error) {
    process.stderr.write("NextGuide init failed: " + error.message + "\n");
    process.exitCode = 1;
  }
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case undefined:
  case "--help":
  case "-h":
  case "help":
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
    init(args);
    break;
  case "page":
    pageCommand(args);
    break;
  case "version":
    await versionCommand(args, version);
    break;
  default:
    process.stderr.write(`Unknown NextGuide command: ${command}\nRun 'nextguide --help' to see available commands.\n`);
    process.exitCode = 2;
}
