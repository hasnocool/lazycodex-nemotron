// lib/doctor.mjs

import { callChat, callResponses, providerHealthConfig } from "./api-client.mjs"
import { getProvider } from "./provider-registry.mjs"
import { RECOMMENDED_ROUTES } from "./model-profile.mjs"

function parseOption(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return null
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
  return value
}

function selectionFromArgs(args) {
  const model = parseOption(args, "--model")
  const provider = parseOption(args, "--provider")
  if (model) {
    if (provider) return { provider, model: model.startsWith(`${provider}/`) ? model.slice(provider.length + 1) : model }
    const slash = model.indexOf("/")
    if (slash > 0) return { provider: model.slice(0, slash), model: model.slice(slash + 1) }
  }
  if (args.includes("--openrouter")) {
    const [, ...parts] = RECOMMENDED_ROUTES.freeReasoning.split("/")
    return { provider: "openrouter", model: parts.join("/") }
  }
  const [, ...parts] = RECOMMENDED_ROUTES.primaryReasoning.split("/")
  return { provider: "nvidia", model: parts.join("/") }
}

export async function runDoctor({ args = [], fetchImpl = fetch } = {}) {
  const selection = selectionFromArgs(args)
  const provider = getProvider(selection.provider)
  const baseUrl = parseOption(args, "--base-url") || provider?.base_url
  const envKey = parseOption(args, "--env-key") || provider?.env_key
  const apiKey = envKey ? process.env[envKey] : null
  const config = providerHealthConfig(selection.provider, selection.model, {
    base_url: baseUrl,
    env_key: envKey,
    wire_api: parseOption(args, "--wire-api") || provider?.wire_api,
  })

  if (!apiKey) {
    return {
      ...config,
      status: "missing-key",
      message: `Set ${envKey || "the provider API key environment variable"} to run a live connectivity check.`,
    }
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const result = config.protocol === "chat"
      ? await callChat({
          provider: selection.provider,
          model: selection.model,
          apiKey,
          messages: [{ role: "user", content: "Reply with OK." }],
          maxTokens: 8,
          baseUrl,
          envKey,
        })
      : await callResponses({
          provider: selection.provider,
          model: selection.model,
          apiKey,
          input: "Reply with OK.",
          baseUrl,
          envKey,
        })

    return {
      ...config,
      status: "ok",
      responseId: result?.id || null,
    }
  } catch (error) {
    return {
      ...config,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export function formatDoctorResult(result) {
  const lines = [
    `Provider: ${result.provider}`,
    `Model: ${result.model}`,
    `Protocol: ${result.protocol}`,
    `Endpoint: ${result.endpoint}`,
    `API key: ${result.envKey ? `${result.envKey} ${result.status === "missing-key" ? "missing" : "present"}` : "custom"}`,
    `Status: ${result.status}`,
  ]
  if (result.message) lines.push(`Message: ${result.message}`)
  return lines.join("\n")
}
