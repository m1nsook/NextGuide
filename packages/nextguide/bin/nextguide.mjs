#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const help = `NextGuide ${version} — early alpha

Usage:
  nextguide --help             Show this help
  nextguide --version          Show the published version
  nextguide doctor [path]      Inspect a local Next.js project
  nextguide doctor --json      Print machine-readable diagnostics

Next.js is mandatory. NextGuide aims to support App Router and Pages Router.
The setup wizard, editor, and init command are not available in this alpha.
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
    process.stdout.write("Note: /setup, /admin and init are not implemented in this alpha.\n");
  }
  if (!result.ok) process.exitCode = 1;
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
    process.stderr.write("NextGuide init is not implemented in " + version + ". This release supports 'nextguide doctor' only.\n");
    process.exitCode = 2;
    break;
  default:
    process.stderr.write(`Unknown NextGuide command: ${command}\nRun 'nextguide --help' to see available commands.\n`);
    process.exitCode = 2;
}
