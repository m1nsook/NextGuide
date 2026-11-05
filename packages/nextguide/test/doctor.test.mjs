import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../bin/nextguide.mjs", import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function fixture({ next = "^16.4.5", folders = ["src/app"] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "nextguide-doctor-"));
  writeFileSync(join(directory, "package.json"), JSON.stringify({
    name: "example-docs",
    dependencies: next ? { next } : {},
  }));
  for (const folder of folders) mkdirSync(join(directory, folder), { recursive: true });
  return directory;
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("CLI file URL resolves to a real filesystem path (including Windows drive letters)", () => {
  assert.equal(existsSync(cli), true, `CLI not found at ${cli}`);
});

test("--version prints first alpha", () => {
  const result = run("--version");
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), version);
});

test("--help lists actual commands", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /not available/);
});

test("doctor accepts an App Router project", () => {
  const directory = fixture();
  try {
    const result = run("doctor", directory, "--json");
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.ok, true);
    assert.equal(data.nextVersion, "^16.4.5");
    assert.deepEqual(data.routers, [{ name: "App Router", folder: "src/app" }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("doctor accepts Pages Router project", () => {
  const directory = fixture({ folders: ["pages"] });
  try {
    const result = run("doctor", directory, "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).routers, [{ name: "Pages Router", folder: "pages" }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("doctor reports both router styles", () => {
  const directory = fixture({ folders: ["app", "src/pages"] });
  try {
    const result = run("doctor", directory, "--json");
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).routers.length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("doctor rejects projects without Next.js", () => {
  const directory = fixture({ next: null });
  try {
    const result = run("doctor", directory, "--json");
    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stdout).issues.join(" "), /Next.js is not declared/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("doctor rejects missing router folders", () => {
  const directory = fixture({ folders: [] });
  try {
    const result = run("doctor", directory, "--json");
    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stdout).issues.join(" "), /No app\//);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("init is not misleadingly offered as working", () => {
  const result = run("init");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not implemented/);
});
