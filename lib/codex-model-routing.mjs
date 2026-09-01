// lib/codex-model-routing.mjs

import { promises as fs } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { homedir } from "node:os"
import { allModels, RECOMMENDED_ROUTES } from "./model-profile.mjs"

const BACKUP_SUFFIX = ".lazycodex-backup"

const KNOWN_PROVIDERS = {
  nvidia: {
    name: "NVIDIA Build",
    base_url: "https://integrate.api.nvidia.com/v1",
    env_key: "NVIDIA_API_KEY",
    wire_api: "chat",
  },
  openrouter: {
    name: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    env_key: "OPENROUTER_API_KEY",
    wire_api: "responses",
  },
}

function codexConfigPath() {
  if (process.env.LAZYCODEX_CODEX_CONFIG) {
    return resolve(process.env.LAZYCODEX_CODEX_CONFIG)
  }
  return join(
    process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : join(homedir(), ".codex"),
    "config.toml",
  )
}

function normalizeModelSelection(modelId, providerId) {
  const raw = modelId?.trim()
  if (!raw) throw new Error("A model ID is required")

  if (providerId) {
    const prefix = `${providerId}/`
    return {
      provider: providerId,
      model: raw.startsWith(prefix) ? raw.slice(prefix.length) : raw,
    }
  }

  const slash = raw.indexOf("/")
  if (slash <= 0) {
    throw new Error("Model IDs must be provider/model, or pass --provider <provider>")
  }

  return { provider: raw.slice(0, slash), model: raw.slice(slash + 1) }
}

function providerBlock(providerId, definition) {
  const lines = [
    `[model_providers.${providerId}]`,
    `name = ${JSON.stringify(definition.name)}`,
    `base_url = ${JSON.stringify(definition.base_url)}`,
  ]
  if (definition.env_key) lines.push(`env_key = ${JSON.stringify(definition.env_key)}`)
  lines.push(`wire_api = ${JSON.stringify(definition.wire_api ?? "responses")}`)
  return `${lines.join("\n")}\n`
}

function profileBlock(profileId, selection, reasoningEffort = "high") {
  return [
    `[profiles.${profileId}]`,
    `model_provider = ${JSON.stringify(selection.provider)}`,
    `model = ${JSON.stringify(selection.model)}`,
    `model_reasoning_effort = ${JSON.stringify(reasoningEffort)}`,
    "",
  ].join("\n")
}

function upsertSection(source, header, body) {
  const lines = source.split(/\r?\n/u)
  const headerIndex = lines.findIndex((line) => line.trim() === header)
  if (headerIndex < 0) return `${source.replace(/\s*$/u, "\n\n")}${body}`

  let end = headerIndex + 1
  while (end < lines.length && !/^\[[^\]]+\]\s*$/u.test(lines[end].trim())) end += 1
  const replacement = body.trimEnd().split("\n")
  return `${[...lines.slice(0, headerIndex), ...replacement, ...lines.slice(end)].join("\n").replace(/\s*$/u, "")}\n`
}

function upsertRootKey(source, key, value) {
  const lines = source.split(/\r?\n/u)
  const firstSection = lines.findIndex((line) => /^\[[^\]]+\]\s*$/u.test(line.trim()))
  const rootEnd = firstSection >= 0 ? firstSection : lines.length
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const keyRegex = new RegExp(`^${escapedKey}\\s*=.*$`, "u")
  const rootIndex = lines.slice(0, rootEnd).findIndex((line) => keyRegex.test(line.trim()))
  const replacement = `${key} = ${JSON.stringify(value)}`

  if (rootIndex >= 0) {
    lines[rootIndex] = replacement
    return lines.join("\n")
  }

  lines.splice(rootEnd, 0, replacement)
  return lines.join("\n")
}

async function backupAndWrite(path, original, next) {
  if (original === next) return null
  await fs.mkdir(dirname(path), { recursive: true })
  const backup = `${path}.${BACKUP_SUFFIX}-${Date.now()}`
  await fs.writeFile(backup, original, "utf8")
  await fs.writeFile(path, next, "utf8")
  return backup
}

function selectedModelFromArgs(args) {
  const modelIndex = args.indexOf("--model")
  if (modelIndex >= 0) {
    const value = args[modelIndex + 1]
    if (!value || value.startsWith("--")) throw new Error("--model requires a model ID")
    return value
  }
  return process.env.LAZYCODEX_MODEL?.trim() || null
}

function selectedProviderFromArgs(args) {
  const index = args.indexOf("--provider")
  if (index >= 0) {
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error("--provider requires a provider ID")
    return value
  }
  return process.env.LAZYCODEX_PROVIDER?.trim() || null
}

function parseOption(args, name, envName) {
  const index = args.indexOf(name)
  if (index >= 0) {
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
    return value
  }
  return process.env[envName]?.trim() || null
}

async function patchCodexAgents(codexHome, model, { dryRun = false } = {}) {
  const agentsDir = join(codexHome, "agents")
  let entries
  try {
    entries = await fs.readdir(agentsDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === "ENOENT") return { changed: [], backups: [] }
    throw error
  }

  const changed = []
  const backups = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".toml")) continue
    const path = join(agentsDir, entry.name)
    const original = await fs.readFile(path, "utf8")
    if (!/^model\s*=\s*"[^"]*"\s*$/mu.test(original)) continue
    const next = original.replace(
      /^model\s*=\s*"[^"]*"\s*$/mu,
      `model = ${JSON.stringify(model)}`,
    )
    if (next === original) continue
    changed.push(path)
    if (!dryRun) {
      const backup = await backupAndWrite(path, original, next)
      if (backup) backups.push(backup)
    }
  }
  return { changed, backups }
}

export function buildCodexSelections({ model, provider, enableNvidia, enableOpenRouter }) {
  if (model) return [normalizeModelSelection(model, provider)]

  const selections = []
  if (enableNvidia) selections.push(normalizeModelSelection(RECOMMENDED_ROUTES.primaryReasoning))
  if (enableOpenRouter) selections.push(normalizeModelSelection(RECOMMENDED_ROUTES.freeReasoning))
  if (selections.length === 0) selections.push(normalizeModelSelection(RECOMMENDED_ROUTES.primaryReasoning))
  return selections
}

export async function configureCodexRouting({ args = [], dryRun = false } = {}) {
  const configPath = codexConfigPath()
  const codexHome = dirname(configPath)
  const model = selectedModelFromArgs(args)
  const provider = selectedProviderFromArgs(args)
  const baseUrl = parseOption(args, "--base-url", "LAZYCODEX_BASE_URL")
  const envKey = parseOption(args, "--env-key", "LAZYCODEX_ENV_KEY")
  const wireApi = parseOption(args, "--wire-api", "LAZYCODEX_WIRE_API") || "responses"
  const enableNvidia = args.includes("--nvidia-build")
  const enableOpenRouter = args.includes("--openrouter")
  const selections = buildCodexSelections({ model, provider, enableNvidia, enableOpenRouter })

  let original = ""
  try {
    original = await fs.readFile(configPath, "utf8")
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }

  let next = original
  const providers = new Map()
  for (const selection of selections) {
    const known = KNOWN_PROVIDERS[selection.provider]
    if (known) {
      providers.set(selection.provider, known)
    } else {
      if (!baseUrl) {
        throw new Error(
          `Unknown provider ${selection.provider}; provide --base-url <url> for a custom provider`,
        )
      }
      providers.set(selection.provider, {
        name: selection.provider,
        base_url: baseUrl,
        env_key: envKey,
        wire_api: wireApi,
      })
    }
  }

  for (const [providerId, definition] of providers) {
    next = upsertSection(next, `[model_providers.${providerId}]`, providerBlock(providerId, definition))
  }

  const primary = selections[0]
  const requestedProfile = parseOption(args, "--profile", "LAZYCODEX_PROFILE") || "lazycodex"
  const profileNames = [requestedProfile]

  next = upsertSection(next, `[profiles.${requestedProfile}]`, profileBlock(requestedProfile, primary))

  if (selections.length > 1) {
    for (const selection of selections) {
      const profileName = `lazycodex-${selection.provider}`
      if (profileName === requestedProfile) continue
      profileNames.push(profileName)
      next = upsertSection(next, `[profiles.${profileName}]`, profileBlock(profileName, selection))
    }
  }

  next = upsertRootKey(next, "profile", requestedProfile)
  next = upsertRootKey(next, "model_provider", primary.provider)
  next = upsertRootKey(next, "model", primary.model)

  const agentResult = await patchCodexAgents(codexHome, primary.model, { dryRun })
  const backupPath = dryRun ? null : await backupAndWrite(configPath, original, next)

  return {
    configPath,
    profileName: requestedProfile,
    primary,
    selections,
    profileNames,
    changed: original !== next,
    backupPath,
    agentResult,
    curatedModels: allModels(),
  }
}

export function codexModelHelp() {
  return [
    "Model-agnostic routing:",
    "  --model <provider/model>        Use any model ID supported by the selected provider.",
    "  --provider <id>                 Explicitly select the Codex model provider.",
    "  --base-url <url>                Required for unknown/custom providers.",
    "  --env-key <ENV_NAME>            API-key environment variable for custom providers.",
    "  --wire-api responses|chat       Request protocol for custom providers.",
    "  --profile <name>                Profile to create/update (default: lazycodex).",
    "",
    "Curated defaults:",
    `  NVIDIA Build: ${RECOMMENDED_ROUTES.primaryReasoning}`,
    `  OpenRouter:   ${RECOMMENDED_ROUTES.freeReasoning}`,
  ].join("\n")
}
