# NVIDIA Build + OpenRouter

LazyCodex 0.3.0 adds a curated provider profile for the NVIDIA Build API and OpenRouter, while preserving the normal OmO installer path.

## Credentials

NVIDIA Build uses the OpenAI-compatible NVIDIA endpoint documented by NVIDIA:

```bash
export NVIDIA_API_KEY="nvapi-..."
```

OpenRouter can be authenticated through OpenCode's `/connect` flow or with its environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

## Configure

Configure the OpenCode user config with the curated model catalog:

```bash
npx lazycodex-ai configure
```

The command detects `~/.config/opencode/opencode.jsonc` first, then `opencode.json`. Existing provider/model entries are preserved and a timestamped backup is created before an existing config is rewritten.

Preview without changing files:

```bash
npx lazycodex-ai --dry-run configure
```

## Install with providers

The provider flags are intercepted by LazyCodex and are not passed to OmO:

```bash
npx lazycodex-ai install --nvidia-build --openrouter
```

Equivalent two-step setup:

```bash
npx lazycodex-ai configure
npx lazycodex-ai install
```

## Model catalog

Print every model in the curated profile:

```bash
npx lazycodex-ai models
```

The profile preserves the user's requested OpenCode model IDs. NVIDIA Build entries use the custom OpenAI-compatible provider ID `nvidia`, so an entry such as:

```text
nvidia/nvidia/nemotron-3-ultra-550b-a55b
```

means provider `nvidia` with NVIDIA Build model ID `nvidia/nemotron-3-ultra-550b-a55b`.

OpenRouter entries retain their native OpenCode form, for example:

```text
openrouter/nvidia/nemotron-3-ultra-550b-a55b:free
openrouter/openrouter/free
```

## Recommended starting routes

The profile includes these starting points, selected from the supplied working model set rather than from a hard-coded provider preference:

| Workload | Model |
| --- | --- |
| Primary reasoning | `nvidia/nvidia/nemotron-3-ultra-550b-a55b` |
| Primary coding | `nvidia/nvidia/nemotron-3.5-lightning-30b-a3b` |
| Deep research | `nvidia/deepseek-ai/deepseek-v4-pro-0813` |
| Fast coding fallback | `nvidia/deepseek-ai/deepseek-v4-flash` |
| Free reasoning | `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` |
| Free coding | `openrouter/cohere/north-mini-code:free` |
| Free fast fallback | `openrouter/nvidia/nemotron-3.5-lightning:free` |
| Universal free fallback | `openrouter/openrouter/free` |

These are routing defaults, not claims that any provider will always be available or that a model will remain free or unchanged. OpenRouter's Free Models Router dynamically selects from its currently available free models.

## Notes

- NVIDIA's hosted API is OpenAI-compatible at `https://integrate.api.nvidia.com/v1`.
- NVIDIA Build model availability and limits can change; the catalog intentionally avoids hard-coding context/output limits that may drift.
- Embedding, voice, and safety models are retained in the catalog for discoverability but should not be treated as general-purpose coding-agent models.
- The upstream OmO installer remains responsible for the Codex plugin installation and agent lifecycle.
