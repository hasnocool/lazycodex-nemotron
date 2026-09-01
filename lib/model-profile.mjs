// lib/model-profile.mjs

export const NVIDIA_BUILD_MODELS = [
  "nvidia/nvidia/nemotron-3-content-safety",
  "nvidia/nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nvidia/nemotron-3.5-lightning-30b-a3b",
  "nvidia/nvidia/nemotron-content-safety-reasoning-4b",
  "nvidia/nvidia/nemotron-mini-4b-instruct",
  "nvidia/nvidia/nemotron-nano-12b-v2-vl",
  "nvidia/nvidia/nemotron-voicechat",
  "nvidia/nvidia/nv-embed-v1",
  "nvidia/nvidia/nv-embedcode-7b-v1",
  "nvidia/deepseek-ai/deepseek-v4-flash",
  "nvidia/deepseek-ai/deepseek-v4-flash-0731",
  "nvidia/deepseek-ai/deepseek-v4-pro",
  "nvidia/deepseek-ai/deepseek-v4-pro-0813",
]

export const GOOGLE_MODELS = [
  "google/gemini-3.6-flash",
  "google/gemini-3.7-flash",
  "google/gemini-embedding-001",
  "google/gemini-embedding-2",
  "google/gemini-flash-latest",
  "google/gemini-flash-lite-latest",
  "google/gemini-omni-flash-preview",
  "google/gemma-4-26b-a4b-it",
  "google/gemma-4-31b-it",
]

export const OPENCODE_MODELS = [
  "opencode/ling-3.0-flash-fin-free",
  "opencode/mimo-v2.5-free",
  "opencode/muse-spark-1.2-contributor-free",
  "opencode/nemotron-3-ultra-free",
  "opencode/nemotron-3.5-lightning-free",
]

export const OPENROUTER_MODELS = [
  "openrouter/cohere/north-mini-code:free",
  "openrouter/dots-studio/dots-3-note-preview:free",
  "openrouter/google/gemma-4-26b-a4b-it:free",
  "openrouter/google/gemma-4-31b-it:free",
  "openrouter/inclusionai/ling-3.0-flash-fin:free",
  "openrouter/liquid/lfm-2.5-2.6b:free",
  "openrouter/minimax/minimax-m2.7:free",
  "openrouter/minimax/minimax-m3:free",
  "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
  "openrouter/nvidia/nemotron-3.5-content-safety:free",
  "openrouter/nvidia/nemotron-3.5-lightning:free",
  "openrouter/poolside/laguna-s-2.1:free",
  "openrouter/poolside/laguna-xs-2.1:free",
  "openrouter/thinkingmachines/inkling-small:free",
  "openrouter/thinkingmachines/inkling:free",
  "openrouter/z-ai/glm-5.2:free",
  "openrouter/openrouter/free",
]

export const MODEL_GROUPS = {
  "NVIDIA Build": NVIDIA_BUILD_MODELS,
  Google: GOOGLE_MODELS,
  OpenCode: OPENCODE_MODELS,
  OpenRouter: OPENROUTER_MODELS,
}

export const RECOMMENDED_ROUTES = {
  primaryReasoning: "nvidia/nvidia/nemotron-3-ultra-550b-a55b",
  primaryCoding: "nvidia/nvidia/nemotron-3.5-lightning-30b-a3b",
  deepResearch: "nvidia/deepseek-ai/deepseek-v4-pro-0813",
  fastCodingFallback: "nvidia/deepseek-ai/deepseek-v4-flash",
  freeReasoning: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
  freeCoding: "openrouter/cohere/north-mini-code:free",
  freeFastFallback: "openrouter/nvidia/nemotron-3.5-lightning:free",
  universalFreeFallback: "openrouter/openrouter/free",
}

function modelName(modelId) {
  return modelId
    .split("/")
    .at(-1)
    .replace(/:free$/u, "")
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase())
}

function toProviderModelMap(models) {
  return Object.fromEntries(
    models.map((fullId) => {
      const [, ...modelParts] = fullId.split("/")
      const modelId = modelParts.join("/")
      return [modelId, { name: modelName(fullId) }]
    }),
  )
}

export function buildNvidiaProvider() {
  return {
    npm: "@ai-sdk/openai-compatible",
    name: "NVIDIA Build",
    options: {
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: "{env:NVIDIA_API_KEY}",
    },
    models: toProviderModelMap(NVIDIA_BUILD_MODELS),
  }
}

export function buildOpenRouterProvider() {
  return {
    models: Object.fromEntries(
      OPENROUTER_MODELS
        .map((fullId) => fullId.slice("openrouter/".length))
        .map((modelId) => [modelId, { name: modelName(modelId) }]),
    ),
  }
}

export function buildProviderPatch() {
  return {
    provider: {
      nvidia: buildNvidiaProvider(),
      openrouter: buildOpenRouterProvider(),
    },
  }
}

export function allModels() {
  return Object.values(MODEL_GROUPS).flat()
}
