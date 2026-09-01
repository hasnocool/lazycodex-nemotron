<!-- docs/STALE_MODEL_CLEANUP.md -->
# Stale model cleanup

LazyCodex tracks the upstream OmO source as the `src` git submodule. The previous pinned snapshot exposed legacy `nemotron-3-nano` assignments for role entries in the Codex model picker.

This cleanup updates only the `src` submodule pointer to a newer upstream OmO snapshot so role/category routing comes from the current upstream model configuration.

No provider registry, custom API adapter, or LazyCodex model catalog entries are removed by this change.
