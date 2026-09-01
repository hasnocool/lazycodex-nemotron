// lib/provider-registry.mjs

export const PROVIDERS = Object.freeze({
  nvidia: Object.freeze({
    id: "nvidia",
    name: "NVIDIA Build",
    base_url: "https://integrate.api.nvidia.com/v1",
    env_key: "NVIDIA_API_KEY",
    wire_api: "chat",
    protocols: Object.freeze(["chat"]),
  }),
  openrouter: Object.freeze({
    id: "openrouter",
    name: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    env_key: "OPENROUTER_API_KEY",
    wire_api: "responses",
    protocols: Object.freeze(["responses", "chat"]),
  }),
})

function inferCapabilities(modelId) {
  const lower = modelId.toLowerCase()
  const embedding = lower.includes("embed") || lower.includes("embedding")
  const voice = lower.includes("voice") || lower.includes("audio")
  const vision = lower.includes("vl") || lower.includes("omni") || lower.includes("vision")
  const reasoning = lower.includes("reason") || lower.includes("thinking") || lower.includes("pro") || lower.includes("ultra")

  return {
    textGeneration: !embedding,
    embeddings: embedding,
    streaming: !embedding,
    tools: !embedding && !voice,
    reasoning,
    vision: !embedding && vision,
    audio: voice,
  }
}

export function getProvider(providerId) {
  return PROVIDERS[providerId] ?? null
}

export function providerDefinition(providerId, overrides = {}) {
  const known = getProvider(providerId)
  if (known) {
    const definedOverrides = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined))
    return { ...known, ...definedOverrides }
  }
  return {
    id: providerId,
    name: overrides.name ?? providerId,
    base_url: overrides.base_url,
    env_key: overrides.env_key,
    wire_api: overrides.wire_api ?? "responses",
    protocols: [overrides.wire_api ?? "responses"],
  }
}

export function modelCapabilities(providerId, modelId) {
  const capabilities = inferCapabilities(modelId)
  if (providerId === "openrouter") return { ...capabilities, streaming: true }
  return capabilities
}

export function modelSupportsProtocol(providerId, protocol) {
  return Boolean(getProvider(providerId)?.protocols.includes(protocol)) ||
    (!getProvider(providerId) && ["chat", "responses"].includes(protocol))
}

export function listProviders() {
  return Object.values(PROVIDERS)
}
