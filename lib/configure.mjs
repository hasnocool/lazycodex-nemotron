// lib/configure.mjs

import { promises as fs } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { buildProviderPatch } from "./model-profile.mjs"

const MANAGED_BACKUP_SUFFIX = ".lazycodex-backup"

function stripJsonComments(source) {
  let output = ""
  let inString = false
  let escaped = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false
        output += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        index += 1
        output += " "
      } else if (char === "\n" || char === "\r") {
        output += char
      }
      continue
    }

    if (inString) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      index += 1
      continue
    }

    if (char === "/" && next === "*") {
      inBlockComment = true
      index += 1
      continue
    }

    output += char
  }

  return output.replace(/,\s*([}\]])/gu, "$1")
}

function parseJsonc(source, path) {
  try {
    return JSON.parse(stripJsonComments(source))
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function mergeProviders(existing, patch) {
  const currentProviders = existing.provider && typeof existing.provider === "object" && !Array.isArray(existing.provider)
    ? existing.provider
    : {}

  const merged = { ...existing, provider: { ...currentProviders } }

  for (const [providerId, providerPatch] of Object.entries(patch.provider)) {
    const current = currentProviders[providerId]
    const currentModels = current?.models && typeof current.models === "object" && !Array.isArray(current.models)
      ? current.models
      : {}
    const patchModels = providerPatch.models ?? {}

    merged.provider[providerId] = {
      ...(current && typeof current === "object" ? current : {}),
      ...providerPatch,
      models: { ...currentModels, ...patchModels },
    }
  }

  return merged
}

export function getOpenCodeConfigPath() {
  if (process.env.LAZYCODEX_OPENCODE_CONFIG) {
    return resolve(process.env.LAZYCODEX_OPENCODE_CONFIG)
  }

  const configHome = process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(homedir(), ".config")

  const jsonc = join(configHome, "opencode", "opencode.jsonc")
  const json = join(configHome, "opencode", "opencode.json")
  return { jsonc, json }
}

async function resolveTargetPath() {
  const configured = getOpenCodeConfigPath()
  if (typeof configured === "string") {
    return configured
  }

  try {
    await fs.access(configured.jsonc)
    return configured.jsonc
  } catch {
    try {
      await fs.access(configured.json)
      return configured.json
    } catch {
      return configured.jsonc
    }
  }
}

export async function configureNvidiaAndOpenRouter({ dryRun = false } = {}) {
  const targetPath = await resolveTargetPath()
  const patch = buildProviderPatch()
  let existing = {}
  let original = null

  try {
    original = await fs.readFile(targetPath, "utf8")
    existing = parseJsonc(original, targetPath)
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error
    }
  }

  const next = mergeProviders(existing, patch)
  next.$schema ??= "https://opencode.ai/config.json"
  const serialized = `${JSON.stringify(next, null, 2)}\n`

  if (dryRun) {
    return { targetPath, changed: original !== serialized, content: serialized, backupPath: null }
  }

  await fs.mkdir(dirname(targetPath), { recursive: true })

  let backupPath = null
  if (original !== null) {
    backupPath = `${targetPath}.${MANAGED_BACKUP_SUFFIX}-${Date.now()}`
    await fs.writeFile(backupPath, original, "utf8")
  }

  await fs.writeFile(targetPath, serialized, "utf8")

  return { targetPath, changed: original !== serialized, content: serialized, backupPath }
}
