// test/provider-adapters.test.mjs

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { callChat, callResponses } from "../lib/api-client.mjs"
import { formatDoctorResult, runDoctor } from "../lib/doctor.mjs"
import { getProvider, listProviders, modelCapabilities, modelSupportsProtocol } from "../lib/provider-registry.mjs"

function mockResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body)
    },
  }
}

describe("provider registry", () => {
  it("exposes NVIDIA and OpenRouter as OpenAI-compatible providers", () => {
    assert.equal(getProvider("nvidia")?.base_url, "https://integrate.api.nvidia.com/v1")
    assert.equal(getProvider("openrouter")?.base_url, "https://openrouter.ai/api/v1")
    assert.equal(modelSupportsProtocol("nvidia", "chat"), true)
    assert.equal(modelSupportsProtocol("nvidia", "responses"), false)
    assert.equal(modelSupportsProtocol("openrouter", "chat"), true)
    assert.equal(modelSupportsProtocol("openrouter", "responses"), true)
    assert.equal(listProviders().length, 2)
  })

  it("derives conservative capabilities for embeddings and generation models", () => {
    assert.equal(modelCapabilities("nvidia", "nv-embed-v1").textGeneration, false)
    assert.equal(modelCapabilities("nvidia", "nv-embed-v1").embeddings, true)
    assert.equal(modelCapabilities("nvidia", "nemotron-ultra-reasoning").reasoning, true)
  })
})

describe("OpenAI-compatible API adapters", () => {
  it("normalizes a chat request for NVIDIA Build", async () => {
    let request
    const result = await callChat({
      provider: "nvidia",
      model: "nvidia-test",
      apiKey: "secret",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 8,
      fetchImpl: async (url, init) => {
        request = { url, init }
        return mockResponse({ id: "chat-1", choices: [] })
      },
    })

    assert.equal(result.id, "chat-1")
    assert.equal(request.url, "https://integrate.api.nvidia.com/v1/chat/completions")
    assert.equal(request.init.method, "POST")
    assert.match(request.init.headers.authorization, /Bearer secret/)
    assert.deepEqual(JSON.parse(request.init.body), {
      model: "nvidia-test",
      messages: [{ role: "user", content: "hello" }],
      stream: false,
      max_tokens: 8,
    })
  })

  it("normalizes a Responses request for OpenRouter", async () => {
    let request
    const result = await callResponses({
      provider: "openrouter",
      model: "nvidia/nemotron-test:free",
      apiKey: "secret",
      input: "hello",
      instructions: "be concise",
      fetchImpl: async (url, init) => {
        request = { url, init }
        return mockResponse({ id: "resp-1", output: [] })
      },
    })

    assert.equal(result.id, "resp-1")
    assert.equal(request.url, "https://openrouter.ai/api/v1/responses")
    assert.equal(request.init.method, "POST")
    assert.equal(request.init.headers["x-title"], "LazyCodex AI")
    assert.deepEqual(JSON.parse(request.init.body), {
      model: "nvidia/nemotron-test:free",
      input: "hello",
      instructions: "be concise",
    })
  })

  it("surfaces provider error responses without leaking credentials", async () => {
    await assert.rejects(
      callChat({
        provider: "nvidia",
        model: "nvidia-test",
        apiKey: "super-secret",
        messages: [{ role: "user", content: "hello" }],
        fetchImpl: async () => mockResponse({ error: { message: "bad request" } }, false, 400),
      }),
      /Provider request failed \(400\): bad request/,
    )
  })
})

describe("doctor", () => {
  it("reports missing credentials without making a request", async () => {
    const previous = process.env.NVIDIA_API_KEY
    delete process.env.NVIDIA_API_KEY
    try {
      const result = await runDoctor({ args: ["--model", "nvidia/nvidia-test"], fetchImpl: async () => { throw new Error("network") } })
      assert.equal(result.status, "missing-key")
      assert.match(formatDoctorResult(result), /NVIDIA_API_KEY missing/)
    } finally {
      if (previous === undefined) delete process.env.NVIDIA_API_KEY
      else process.env.NVIDIA_API_KEY = previous
    }
  })

  it("performs a minimal live-style health request with an injected fetch", async () => {
    const previous = process.env.NVIDIA_API_KEY
    process.env.NVIDIA_API_KEY = "test-key"
    let calls = 0
    try {
      const result = await runDoctor({
        args: ["--model", "nvidia/nvidia-test"],
        fetchImpl: async () => {
          calls += 1
          return mockResponse({ id: "doctor-1", choices: [] })
        },
      })
      assert.equal(result.status, "ok")
      assert.equal(result.responseId, "doctor-1")
      assert.equal(calls, 1)
    } finally {
      if (previous === undefined) delete process.env.NVIDIA_API_KEY
      else process.env.NVIDIA_API_KEY = previous
    }
  })
})
