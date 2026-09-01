#!/usr/bin/env node

// bin/lazycodex-ai.js

import { spawn } from "node:child_process"
import { configureNvidiaAndOpenRouter, getOpenCodeConfigPath } from "../lib/configure.mjs"
import { configureCodexRouting, codexModelHelp } from "../lib/codex-model-routing.mjs"
import { formatDoctorResult, runDoctor } from "../lib/doctor.mjs"
import { MODEL_GROUPS, RECOMMENDED_ROUTES } from "../lib/model-profile.mjs"

const args = process.argv.slice(2)
const dryRun = args[0] === "--dry-run"
const forwardedArgs = dryRun ? args.slice(1) : args

function hasRoutingFlag(name) {
  return forwardedArgs.includes(name)
}

function hasRoutingConfiguration() {
  return [
    "--nvidia-build",
    "--openrouter",
    "--any-model",
    "--model",
    "--provider",
    "--base-url",
    "--env-key",
    "--wire-api",
    "--reasoning-effort",
    "--patch-agents",
    "--profile",
  ].some((flag) => forwardedArgs.includes(flag))
}

function stripRoutingFlags(values) {
  const valueFlags = new Set([
    "--model",
    "--provider",
    "--base-url",
    "--env-key",
    "--wire-api",
    "--reasoning-effort",
    "--profile",
  ])
  const result = []
  for (let index = 0; index < values.length; index += 1) {
    if (valueFlags.has(values[index])) {
      index += 1
      continue
    }
    if (values[index] === "--nvidia-build" || values[index] === "--openrouter" || values[index] === "--any-model" || values[index] === "--patch-agents") {
      continue
    }
    result.push(values[index])
  }
  return result
}

function spawnAsync(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit" })
    child.once("error", reject)
    child.once("close", (code, signal) => resolve(signal ? 1 : code ?? 1))
  })
}

function printModels() {
  for (const [group, models] of Object.entries(MODEL_GROUPS)) {
    console.log(`\n${group}`)
    for (const model of models) console.log(`  ${model}`)
  }
  console.log("\nRecommended routes")
  for (const [role, model] of Object.entries(RECOMMENDED_ROUTES)) console.log(`  ${role}: ${model}`)
  console.log(`\n${codexModelHelp()}`)
}

async function configureRouting({ dryRun: isDryRun }) {
  const codex = await configureCodexRouting({ args: forwardedArgs, dryRun: isDryRun })
  const openCode = await configureNvidiaAndOpenRouter({ dryRun: isDryRun })

  if (isDryRun) {
    console.log(`Codex: ${codex.configPath}`)
    console.log(`Codex profile: ${codex.profileName}`)
    console.log(`Codex primary: ${codex.primary.provider}/${codex.primary.model}`)
    console.log(`Agent patching: ${codex.patchAgents ? "enabled" : "disabled"}`)
    console.log(`OpenCode: ${openCode.targetPath}`)
    return
  }

  console.log(`Configured Codex model routing in ${codex.configPath}`)
  console.log(`Active profile: ${codex.profileName} (${codex.primary.provider}/${codex.primary.model})`)
  console.log(`Agent patching: ${codex.patchAgents ? "enabled" : "disabled"}`)
  if (codex.backupPath) console.log(`Codex backup: ${codex.backupPath}`)
  for (const backup of codex.agentResult.backups) console.log(`Agent backup: ${backup}`)
  console.log(`Configured OpenCode providers in ${openCode.targetPath}`)
  if (openCode.backupPath) console.log(`OpenCode backup: ${openCode.backupPath}`)
}

async function main() {
  const command = forwardedArgs[0]

  if (command === "models" || command === "model-list") {
    printModels()
    return
  }

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(codexModelHelp())
    return
  }

  if (command === "doctor") {
    const result = await runDoctor({ args: forwardedArgs.slice(1) })
    console.log(formatDoctorResult(result))
    if (result.status === "failed") process.exitCode = 1
    return
  }

  if (command === "configure" || command === "providers") {
    await configureRouting({ dryRun })
    return
  }

  const configureProviders = command === "install" && hasRoutingConfiguration()
  const cleanedArgs = stripRoutingFlags(forwardedArgs)
  const commandArgs = cleanedArgs[0] === "install"
    ? ["--yes", "--package", "oh-my-openagent", "omo", "install", "--platform=codex", ...cleanedArgs.slice(1)]
    : ["--yes", "--package", "oh-my-openagent", "omo", ...cleanedArgs]

  if (dryRun) {
    console.log(["npx", ...commandArgs].join(" "))
    if (configureProviders) {
      const configPath = getOpenCodeConfigPath()
      const displayPath = typeof configPath === "string" ? configPath : configPath.jsonc
      console.log(`configure: ${displayPath}`)
      console.log(`Codex routing: ${hasRoutingFlag("--model") ? "custom model" : "curated model profile"}`)
    }
    return
  }

  const exitCode = await spawnAsync("npx", commandArgs)
  if (exitCode !== 0) process.exit(exitCode)
  if (configureProviders) await configureRouting({ dryRun: false })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
