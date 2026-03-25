import * as p from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { parseArgs } from "./cli.js";
import { runPrompts } from "./prompts.js";
import { loadRegistry } from "./registry.js";
import { scaffold } from "./scaffold.js";
import { runEnhancers } from "./enhancers/index.js";
import { ProjectConfig } from "./types.js";

// ---------------------------------------------------------------------------
// README generator — creates a README.md inside the scaffolded project
// ---------------------------------------------------------------------------

function generateReadme(config: ProjectConfig): string {
  const hasDocker = config.enhancements.includes("docker");

  const lines: string[] = [
    `# ${config.name}`,
    "",
    "Scaffolded with **create-kickstart**.",
    "",
    "## Quick Start",
    "",
    "```bash",
    "bash scripts/setup.sh",
    "bash scripts/dev.sh",
    "```",
    "",
    "## Commands",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `make setup` | Install dependencies |",
    "| `make dev` | Start development server |",
    "| `make test` | Run tests |",
    "| `make lint` | Run linters |",
    "| `make build` | Production build |",
  ];

  if (hasDocker) {
    lines.push(
      "",
      "## Docker",
      "",
      "```bash",
      "docker compose up        # start all services",
      "docker compose up -d     # start in background",
      "docker compose down      # stop all services",
      "```",
    );
  }

  lines.push(
    "",
    "## Documentation",
    "",
    "See `CLAUDE.md` or `AI_CONTEXT.md` for detailed docs.",
    "",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Git init
// ---------------------------------------------------------------------------

async function initGitRepo(targetDir: string): Promise<void> {
  await execa("git", ["init"], { cwd: targetDir, stdio: "pipe" });
  await execa("git", ["add", "."], { cwd: targetDir, stdio: "pipe" });
  await execa("git", ["-c", "user.name=create-kickstart", "-c", "user.email=noreply@kickstart.dev", "commit", "-m", "Initial commit from create-kickstart"], {
    cwd: targetDir,
    stdio: "pipe",
  });
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  p.intro(chalk.bgCyan(chalk.black(" create-kickstart ")));

  // 1. Parse args
  const args = parseArgs(process.argv);

  // 2. Load registry
  const registrySpinner = p.spinner();
  registrySpinner.start("Loading framework registry...");
  const registry = await loadRegistry();
  registrySpinner.stop("Registry loaded");

  // 3. Get config (interactive or flags)
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

  // 4. Summary
  p.log.step(chalk.bold("Project configuration:"));
  p.log.info(`  Name:         ${config.name}`);
  p.log.info(`  Type:         ${config.type}`);
  if (config.frontend) p.log.info(`  Frontend:     ${config.frontend}`);
  if (config.backend) p.log.info(`  Backend:      ${config.backend}`);
  if (config.standalone) p.log.info(`  Stack:        ${config.standalone}`);
  p.log.info(`  Enhancements: ${config.enhancements.join(", ")}`);
  p.log.info(`  Directory:    ${config.targetDir}`);

  // 5. Phase 1: Scaffold
  await scaffold(config, registry);

  // 6. Phase 2: Enhancers
  await runEnhancers(config, registry);

  // 7. Phase 3: Generate README.md
  const readmeSpinner = p.spinner();
  readmeSpinner.start("Generating README.md...");
  const readmeContent = generateReadme(config);
  await fs.writeFile(path.join(config.targetDir, "README.md"), readmeContent, "utf-8");
  readmeSpinner.stop("README.md generated");

  // 8. Initialize git repo
  const gitSpinner = p.spinner();
  gitSpinner.start("Initializing git repository...");
  try {
    await initGitRepo(config.targetDir);
    gitSpinner.stop("Git repository initialized");
  } catch {
    gitSpinner.stop("Git init skipped (git not available)");
  }

  // 9. Next steps
  p.outro(chalk.green("Project created successfully!"));

  console.log();
  console.log(chalk.bold("  Next steps:"));
  console.log();
  console.log(`  ${chalk.cyan("cd")} ${config.name}`);
  console.log(`  ${chalk.cyan("make setup")}    ${chalk.gray("# install dependencies")}`);
  console.log(`  ${chalk.cyan("make dev")}      ${chalk.gray("# start dev server")}`);
  console.log(`  ${chalk.cyan("make test")}     ${chalk.gray("# run tests")}`);
  console.log(`  ${chalk.cyan("make lint")}     ${chalk.gray("# run linters")}`);
  console.log(`  ${chalk.cyan("make build")}    ${chalk.gray("# production build")}`);

  if (config.enhancements.includes("docker")) {
    console.log();
    console.log(`  ${chalk.cyan("docker compose up")}  ${chalk.gray("# start with Docker")}`);
  }

  console.log();
  console.log(chalk.gray("  See CLAUDE.md or AI_CONTEXT.md for AI-friendly docs."));
  console.log();
}

main().catch(console.error);
