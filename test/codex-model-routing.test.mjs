// test/codex-model-routing.test.mjs

import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { configureCodexRouting } from "../lib/codex-model-routing.mjs"

describe("Codex model routing", () => {
  it("configures an arbitrary model on a known provider and patches installed agents", async () => {
    const root = await mkdtemp(join(tmpdir(), "lazycodex-routing-"))
    const codexHome = join(root, ".codex")
    const configPath = join(codexHome, "config.toml")
    const agentsDir = join(codexHome, "agents")
    const agentPath = join(agentsDir, "sisyphus.toml")
    await mkdir(agentsDir, { recursive: true })

    await writeFile(agentPath, 'name = "sisyphus"\nmodel = "gpt-5.6-sol"\n', "utf8")

    const previousHome = process.env.CODEX_HOME
    const previousConfig = process.env.LAZYCODEX_CODEX_CONFIG
    process.env.CODEX_HOME = codexHome
    process.env.LAZYCODEX_CODEX_CONFIG = configPath

    try {
      const result = await configureCodexRouting({
        args: ["--model", "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", "--profile", "nemotron"],
      })

      assert.equal(result.primary.provider, "openrouter")
      assert.equal(result.primary.model, "nvidia/nemotron-3-ultra-550b-a55b:free")
      assert.equal(result.profileName, "nemotron")

      const config = await readFile(configPath, "utf8")
      assert.match(config, /\[model_providers\.openrouter\]/)
      assert.match(config, /base_url = "https:\/\/openrouter\.ai\/api\/v1"/)
      assert.match(config, /\[profiles\.nemotron\]/)
      assert.match(config, /model_provider = "openrouter"/)
      assert.match(config, /model = "nvidia\/nemotron-3-ultra-550b-a55b:free"/)

      const agent = await readFile(agentPath, "utf8")
      assert.match(agent, /model = "nvidia\/nemotron-3-ultra-550b-a55b:free"/)
    } finally {
      if (previousHome === undefined) delete process.env.CODEX_HOME
      else process.env.CODEX_HOME = previousHome
      if (previousConfig === undefined) delete process.env.LAZYCODEX_CODEX_CONFIG
      else process.env.LAZYCODEX_CODEX_CONFIG = previousConfig
    }
  })

  it("supports a completely custom OpenAI-compatible provider", async () => {
    const root = await mkdtemp(join(tmpdir(), "lazycodex-custom-"))
    const configPath = join(root, "config.toml")
    const previousConfig = process.env.LAZYCODEX_CODEX_CONFIG
    process.env.LAZYCODEX_CODEX_CONFIG = configPath

    try {
      await configureCodexRouting({
        args: [
          "--model", "my-provider/my-model",
          "--provider", "my-provider",
          "--base-url", "https://example.test/v1",
          "--env-key", "MY_PROVIDER_API_KEY",
          "--wire-api", "chat",
        ],
      })

      const config = await readFile(configPath, "utf8")
      assert.match(config, /\[model_providers\.my-provider\]/)
      assert.match(config, /base_url = "https:\/\/example\.test\/v1"/)
      assert.match(config, /env_key = "MY_PROVIDER_API_KEY"/)
      assert.match(config, /wire_api = "chat"/)
      assert.match(config, /model = "my-model"/)
    } finally {
      if (previousConfig === undefined) delete process.env.LAZYCODEX_CODEX_CONFIG
      else process.env.LAZYCODEX_CODEX_CONFIG = previousConfig
    }
  })

  it("creates a valid primary profile plus provider-specific profiles for curated dual-provider setup", async () => {
    const root = await mkdtemp(join(tmpdir(), "lazycodex-dual-"))
    const configPath = join(root, "config.toml")
    const previousConfig = process.env.LAZYCODEX_CODEX_CONFIG
    process.env.LAZYCODEX_CODEX_CONFIG = configPath

    try {
      const result = await configureCodexRouting({ args: ["--nvidia-build", "--openrouter"] })
      const config = await readFile(configPath, "utf8")

      assert.equal(result.profileName, "lazycodex")
      assert.match(config, /\[profiles\.lazycodex\]/)
      assert.match(config, /\[profiles\.lazycodex-nvidia\]/)
      assert.match(config, /\[profiles\.lazycodex-openrouter\]/)
      assert.match(config, /^profile = "lazycodex"$/m)
      assert.match(config, /^model_provider = "nvidia"$/m)
      assert.match(config, /^model = "nvidia\/nemotron-3-ultra-550b-a55b"$/m)
    } finally {
      if (previousConfig === undefined) delete process.env.LAZYCODEX_CODEX_CONFIG
      else process.env.LAZYCODEX_CODEX_CONFIG = previousConfig
    }
  })
})
