#!/usr/bin/env node

// bin/lazycodex-ai.js

import { spawn } from "node:child_process"
import { configureNvidiaAndOpenRouter, getOpenCodeConfigPath } from "../lib/configure.mjs"
import { MODEL_GROUPS, RECOMMENDED_ROUTES } from "../lib/model-profile.mjs"

const args = process.argv.slice(2)
const dryRun = args[0] === "--dry-run"
const forwardedArgs = dryRun ? args.slice(1) : args

function hasProviderFlag(name) {
  return forwardedArgs.includes(name)
}

function stripProviderFlags(values) {
  return values.filter((value) => value !== "--nvidia-build" && value !== "--openrouter")
}

function spawnAsync(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit" })

    child.once("error", reject)
    child.once("close", (code, signal) => {
      if (signal) {
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
}

function printModels() {
  for (const [group, models] of Object.entries(MODEL_GROUPS)) {
    console.log(`\n${group}`)
    for (const model of models) {
      console.log(`  ${model}`)
    }
  }

  console.log("\nRecommended routes")
  for (const [role, model] of Object.entries(RECOMMENDED_ROUTES)) {
    console.log(`  ${role}: ${model}`)
  }
}

async function main() {
  const command = forwardedArgs[0]

  if (command === "models" || command === "model-list") {
    printModels()
    return
  }

  if (command === "configure" || command === "providers") {
    const result = await configureNvidiaAndOpenRouter({ dryRun })
    if (dryRun) {
      console.log(`Would update ${result.targetPath} with the NVIDIA Build and OpenRouter provider profile.`)
      return
    }

    console.log(`Configured NVIDIA Build and OpenRouter in ${result.targetPath}`)
    if (result.backupPath) {
      console.log(`Backup created at ${result.backupPath}`)
    }
    if (!process.env.NVIDIA_API_KEY) {
      console.warn("Warning: NVIDIA_API_KEY is not set in the current environment.")
    }
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn("Warning: OPENROUTER_API_KEY is not set; use OpenCode /connect for OpenRouter credentials.")
    }
    return
  }

  const configureProviders = command === "install" && (hasProviderFlag("--nvidia-build") || hasProviderFlag("--openrouter"))
  const cleanedArgs = stripProviderFlags(forwardedArgs)

  const commandArgs =
    cleanedArgs[0] === "install"
      ? [
          "--yes",
          "--package",
          "oh-my-openagent",
          "omo",
          "install",
          "--platform=codex",
          ...cleanedArgs.slice(1),
        ]
      : ["--yes", "--package", "oh-my-openagent", "omo", ...cleanedArgs]

  if (dryRun) {
    console.log(["npx", ...commandArgs].join(" "))
    if (configureProviders) {
      const configPath = getOpenCodeConfigPath()
      const displayPath = typeof configPath === "string" ? configPath : configPath.jsonc
      console.log(`configure: ${displayPath}`)
    }
    return
  }

  const exitCode = await spawnAsync("npx", commandArgs)
  if (exitCode !== 0) {
    process.exit(exitCode)
  }

  if (configureProviders) {
    const result = await configureNvidiaAndOpenRouter()
    console.log(`Configured NVIDIA Build and OpenRouter in ${result.targetPath}`)
    if (result.backupPath) {
      console.log(`Backup created at ${result.backupPath}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
