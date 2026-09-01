// lib/api-client.mjs

import { getProvider, providerDefinition, modelCapabilities, modelSupportsProtocol } from "./provider-registry.mjs"

function apiUrl(definition, protocol) {
  const base = definition.base_url.replace(/\/$/u, "")
  return protocol === "chat" ? `${base}/chat/completions` : `${base}/responses`
}

function authHeaders(definition, apiKey) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  }
  if (definition.id === "openrouter") {
    headers["http-referer"] = process.env.OPENROUTER_HTTP_REFERER || "https://github.com/hasnocool/lazycodex-nemotron"
    headers["x-title"] = process.env.OPENROUTER_APP_TITLE || "LazyCodex AI"
  }
  return headers
}

async function parseResponse(response) {
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    const detail = typeof body === "string" ? body : body?.error?.message || body?.message || `HTTP ${response.status}`
    throw new Error(`Provider request failed (${response.status}): ${detail}`)
  }
  return body
}

function resolveDefinition(providerId, overrides = {}) {
  const known = getProvider(providerId)
  if (known) return providerDefinition(providerId, overrides)
  if (!overrides.base_url) throw new Error(`Unknown provider ${providerId}; a base URL is required`)
  return providerDefinition(providerId, overrides)
}

export async function callChat({ provider, model, apiKey, messages, temperature, maxTokens, signal, baseUrl, envKey, fetchImpl = fetch }) {
  const definition = resolveDefinition(provider, { base_url: baseUrl, env_key: envKey, wire_api: "chat" })
  if (!modelSupportsProtocol(provider, "chat")) throw new Error(`Provider ${provider} does not support the chat protocol`)
  const capabilities = modelCapabilities(provider, model)
  if (!capabilities.textGeneration) throw new Error(`Model ${model} is not a text-generation model`)

  const payload = { model, messages, stream: false }
  if (temperature !== undefined) payload.temperature = temperature
  if (maxTokens !== undefined) payload.max_tokens = maxTokens
  const response = await fetchImpl(apiUrl(definition, "chat"), {
    method: "POST",
    headers: authHeaders(definition, apiKey),
    body: JSON.stringify(payload),
    signal,
  })
  return parseResponse(response)
}

export async function callResponses({ provider, model, apiKey, input, instructions, signal, baseUrl, envKey, fetchImpl = fetch }) {
  const definition = resolveDefinition(provider, { base_url: baseUrl, env_key: envKey, wire_api: "responses" })
  if (!modelSupportsProtocol(provider, "responses")) throw new Error(`Provider ${provider} does not support the responses protocol`)
  const capabilities = modelCapabilities(provider, model)
  if (!capabilities.textGeneration) throw new Error(`Model ${model} is not a text-generation model`)

  const payload = { model, input }
  if (instructions) payload.instructions = instructions
  const response = await fetchImpl(apiUrl(definition, "responses"), {
    method: "POST",
    headers: authHeaders(definition, apiKey),
    body: JSON.stringify(payload),
    signal,
  })
  return parseResponse(response)
}

export function providerHealthConfig(providerId, modelId, overrides = {}) {
  const definition = resolveDefinition(providerId, overrides)
  return {
    provider: providerId,
    model: modelId,
    endpoint: apiUrl(definition, definition.wire_api),
    protocol: definition.wire_api,
    envKey: definition.env_key,
    capabilities: modelCapabilities(providerId, modelId),
  }
}
