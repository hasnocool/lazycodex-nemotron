# Model-Agnostic Routing

LazyCodex 0.4.0 removes the assumption that the installed agent must use a ChatGPT/OpenAI frontier model. The Codex configuration layer now accepts any OpenAI-compatible provider/model pair, while the supplied NVIDIA Build and OpenRouter catalog remains the ready-to-use default.

## What changed

The upstream OmO agent code still contains some model-family-specific behavior. LazyCodex therefore removes the restriction at the Codex integration boundary rather than pretending those upstream prompt specializations do not exist.

After OmO installs its agent files, LazyCodex can rewrite their `model = ...` entries to the selected model. Existing Codex configuration and agent files are backed up before modification.

This is model/provider routing, not removal of tool-permission or operating-system safety controls.

## Credentials

NVIDIA Build uses NVIDIA's OpenAI-compatible chat-completions endpoint:

```bash
export NVIDIA_API_KEY="nvapi-..."
```

OpenRouter can be authenticated with:

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

## Use any model

The primary interface is a provider-qualified model ID:

```bash
npx lazycodex-ai configure \
  --model openrouter/nvidia/nemotron-3-ultra-550b-a55b:free \
  --provider openrouter
```

You can use a completely different OpenAI-compatible provider without changing LazyCodex:

```bash
npx lazycodex-ai configure \
  --model my-provider/my-model \
  --provider my-provider \
  --base-url https://example.com/v1 \
  --env-key MY_PROVIDER_API_KEY \
  --wire-api chat
```

`responses` and `chat` are supported for custom providers through `--wire-api`.

## Curated NVIDIA/OpenRouter defaults

The curated profile remains available and is the default when no explicit model is supplied.

```bash
npx lazycodex-ai configure
```

Or enable both provider profiles:

```bash
npx lazycodex-ai install --nvidia-build --openrouter
```

This creates a primary `lazycodex` profile plus provider-specific `lazycodex-nvidia` and `lazycodex-openrouter` profiles.

## Recommended starting routes

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

These are defaults from the supplied working model set. They are not hard-coded limits on what LazyCodex can use.

## Model catalog

Print the entire curated catalog:

```bash
npx lazycodex-ai models
```

The catalog preserves the supplied IDs for NVIDIA Build, Google, OpenCode, and OpenRouter. NVIDIA Build IDs use the outer `nvidia/` prefix for the provider and retain the NVIDIA model namespace inside it; for example:

```text
nvidia/nvidia/nemotron-3-ultra-550b-a55b
```

OpenRouter entries use the native OpenRouter provider followed by the upstream model ID:

```text
openrouter/nvidia/nemotron-3-ultra-550b-a55b:free
openrouter/openrouter/free
```

Embedding, voice, and safety models remain discoverable in the catalog but are not recommended as general coding-agent defaults.

## Configuration files

Codex configuration is written to:

```text
$CODEX_HOME/config.toml
```

or `~/.codex/config.toml` when `CODEX_HOME` is not set. Set `LAZYCODEX_CODEX_CONFIG` to override the exact file path for testing or isolated installations.

OpenCode's provider profile is still maintained separately under `~/.config/opencode/opencode.jsonc` (or `opencode.json`) by the existing provider configuration command.

## Verify

Preview the exact installation/routing behavior without changing files:

```bash
npx lazycodex-ai --dry-run install --model openrouter/nvidia/nemotron-3-ultra-550b-a55b:free --provider openrouter
```

Show routing help:

```bash
npx lazycodex-ai help
```

Run the test suite in a checkout:

```bash
npm test
```
