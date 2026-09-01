// test/lazycodex-ai-bin.test.mjs

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"

const root = new URL("..", import.meta.url).pathname
const packageJsonPath = join(root, "package.json")
const packageLockPath = join(root, "package-lock.json")
const publishWorkflowPath = join(root, ".github", "workflows", "npm-publish.yml")
const binPath = join(root, "bin", "lazycodex-ai.js")
const releaseVersion = "0.4.0"

describe("lazycodex-ai npm package", () => {
  it("maps the package name and bin to lazycodex-ai", () => {
    assert.equal(existsSync(packageJsonPath), true, "root package.json must exist")
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    assert.equal(manifest.name, "lazycodex-ai")
    assert.equal(manifest.version, releaseVersion)
    assert.equal(manifest.bin?.["lazycodex-ai"], "bin/lazycodex-ai.js")
    assert.equal(manifest.private, undefined)
  })

  it("keeps publish metadata aligned with the release version", () => {
    assert.equal(existsSync(packageJsonPath), true, "package.json must exist")
    assert.equal(existsSync(packageLockPath), true, "package-lock.json must exist")
    assert.equal(existsSync(publishWorkflowPath), true, "npm publish workflow must exist")
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const lockfile = JSON.parse(readFileSync(packageLockPath, "utf8"))
    const publishWorkflow = readFileSync(publishWorkflowPath, "utf8")
    assert.equal(manifest.version, releaseVersion)
    assert.equal(lockfile.version, releaseVersion)
    assert.equal(lockfile.packages?.[""]?.version, releaseVersion)
    assert.match(publishWorkflow, new RegExp(`default: "${releaseVersion}"`))
  })

  it("dry-runs install through oh-my-openagent with the Codex platform default", () => {
    assert.equal(existsSync(binPath), true, "lazycodex-ai bin must exist")
    const result = spawnSync(
      process.execPath,
      [binPath, "--dry-run", "install", "--no-tui", "--codex-autonomous"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^npx --yes --package oh-my-openagent omo install --platform=codex --no-tui --codex-autonomous\n?$/)
  })

  it("dry-runs model-agnostic install without leaking routing flags upstream", () => {
    assert.equal(existsSync(binPath), true, "lazycodex-ai bin must exist")
    const result = spawnSync(
      process.execPath,
      [
        binPath,
        "--dry-run",
        "install",
        "--model",
        "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
        "--provider",
        "openrouter",
      ],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /--model|--provider/)
    assert.match(result.stdout, /npx --yes --package oh-my-openagent omo install --platform=codex/)
    assert.match(result.stdout, /Codex routing: custom model/)
  })

  it("lists the curated model profile and model-agnostic help", () => {
    assert.equal(existsSync(binPath), true, "lazycodex-ai bin must exist")
    const result = spawnSync(process.execPath, [binPath, "models"], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /NVIDIA Build/)
    assert.match(result.stdout, /nvidia\/nvidia\/nemotron-3-ultra-550b-a55b/)
    assert.match(result.stdout, /OpenRouter/)
    assert.match(result.stdout, /openrouter\/openrouter\/free/)
    assert.match(result.stdout, /--model <provider\/model>/)
  })

  it("dry-runs non-install commands through oh-my-openagent", () => {
    assert.equal(existsSync(binPath), true, "lazycodex-ai bin must exist")
    const result = spawnSync(process.execPath, [binPath, "--dry-run", "doctor"], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), "npx --yes --package oh-my-openagent omo doctor")
  })
})
