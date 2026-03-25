import * as p from "@clack/prompts";
import chalk from "chalk";
import { parseArgs } from "./cli.js";
import { runPrompts } from "./prompts.js";
import { loadRegistry } from "./registry.js";
import { ProjectConfig } from "./types.js";

async function main() {
  p.intro(chalk.bgCyan(chalk.black(" create-kickstart ")));

  const args = parseArgs(process.argv);

  // Load registry
  const registrySpinner = p.spinner();
  registrySpinner.start("Loading framework registry...");
  const registry = await loadRegistry();
  registrySpinner.stop("Registry loaded");

  // Get config (interactive or from flags)
  let config: ProjectConfig;
  if (args.interactive) {
    config = await runPrompts(args);
  } else {
    if (!args.name) {
      p.cancel("Project name is required in non-interactive mode");
      process.exit(1);
    }
    if (!args.type) {
      p.cancel("--type is required in non-interactive mode");
      process.exit(1);
    }
    config = {
      name: args.name,
      type: args.type!,
      frontend: args.frontend,
      backend: args.backend,
      standalone: args.standalone,
      enhancements: args.enhancements?.length
        ? args.enhancements
        : ["docker", "ci", "lint", "test", "env", "ai-context"],
      targetDir: `${process.cwd()}/${args.name}`,
    };
  }

  // Summary
  p.log.step(chalk.bold("Project configuration:"));
  p.log.info(`  Name:         ${config.name}`);
  p.log.info(`  Type:         ${config.type}`);
  if (config.frontend) p.log.info(`  Frontend:     ${config.frontend}`);
  if (config.backend) p.log.info(`  Backend:      ${config.backend}`);
  if (config.standalone) p.log.info(`  Stack:        ${config.standalone}`);
  p.log.info(`  Enhancements: ${config.enhancements.join(", ")}`);
  p.log.info(`  Directory:    ${config.targetDir}`);

  p.outro("Config ready — scaffolding coming next!");
}

main().catch(console.error);
