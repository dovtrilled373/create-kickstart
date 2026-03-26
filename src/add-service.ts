import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import { AddServiceConfig, BackendStack, Enhancement, DatabaseChoice } from "./types.js";
import { loadRegistry, getRegistryEntry } from "./registry.js";
import { scaffold } from "./scaffold.js";
import { runEnhancers } from "./enhancers/index.js";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// CLI parsing for "add" subcommand
// ---------------------------------------------------------------------------

export function parseAddArgs(argv: string[]): Partial<AddServiceConfig> & { interactive: boolean } {
  // argv after "add": e.g., ["payment-svc", "--backend", "fastapi", "--with", "db,test"]
  let serviceName: string | undefined;
  let backend: BackendStack | undefined;
  let enhancements: Enhancement[] = [];
  let database: DatabaseChoice | undefined;
  let interactive = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--backend" && argv[i + 1]) {
      backend = argv[++i] as BackendStack;
    } else if (arg === "--with" && argv[i + 1]) {
      enhancements = argv[++i].split(",").map((e) => e.trim() as Enhancement);
    } else if (arg === "--database" && argv[i + 1]) {
      database = argv[++i] as DatabaseChoice;
    } else if (arg === "--no-interactive") {
      interactive = false;
    } else if (!arg.startsWith("-") && !serviceName) {
      serviceName = arg;
    }
  }

  return { serviceName, backend, enhancements, database, targetDir: process.cwd(), interactive };
}

// ---------------------------------------------------------------------------
// Interactive prompts for "add"
// ---------------------------------------------------------------------------

async function promptAddService(partial: Partial<AddServiceConfig>): Promise<AddServiceConfig> {
  const serviceName =
    partial.serviceName ??
    ((await p.text({
      message: "Service name:",
      placeholder: "payment-service",
      validate: (v) => {
        if (!v) return "Name is required";
        if (!/^[a-z0-9-]+$/.test(v)) return "Use lowercase letters, numbers, hyphens only";
      },
    })) as string);
  if (p.isCancel(serviceName)) process.exit(0);

  const backend =
    partial.backend ??
    ((await p.select({
      message: "Pick the backend stack for this service:",
      options: [
        { value: "fastapi", label: "FastAPI", hint: "Python" },
        { value: "express", label: "Express", hint: "TypeScript" },
        { value: "hono", label: "Hono", hint: "TypeScript" },
        { value: "django", label: "Django", hint: "Python" },
        { value: "go-chi", label: "Go (Chi)", hint: "Go" },
        { value: "spring-boot", label: "Spring Boot", hint: "Java" },
      ],
    })) as BackendStack);
  if (p.isCancel(backend)) process.exit(0);

  const enhancements =
    partial.enhancements && partial.enhancements.length > 0
      ? partial.enhancements
      : ((await p.multiselect({
          message: "Enhancements for this service:",
          options: [
            { value: "docker", label: "Dockerfile" },
            { value: "test", label: "Testing scaffold" },
            { value: "lint", label: "Linting" },
            { value: "db", label: "Database" },
            { value: "logging", label: "Structured logging" },
            { value: "sample-crud", label: "Sample CRUD endpoints" },
            { value: "auth", label: "Auth scaffold" },
          ],
          initialValues: ["test", "lint", "sample-crud"],
        })) as Enhancement[]);
  if (p.isCancel(enhancements)) process.exit(0);

  return {
    serviceName,
    backend,
    enhancements,
    database: partial.database,
    targetDir: partial.targetDir ?? process.cwd(),
  };
}

// ---------------------------------------------------------------------------
// Main "add" logic
// ---------------------------------------------------------------------------

export async function runAddService(argv: string[]): Promise<void> {
  p.intro(chalk.bgCyan(chalk.black(" create-kickstart add ")));

  const args = parseAddArgs(argv);
  let addConfig: AddServiceConfig;

  if (args.interactive) {
    addConfig = await promptAddService(args);
  } else {
    if (!args.serviceName || !args.backend) {
      p.cancel("Service name and --backend are required in non-interactive mode");
      process.exit(1);
    }
    addConfig = {
      serviceName: args.serviceName,
      backend: args.backend,
      enhancements: args.enhancements ?? ["test", "lint"],
      database: args.database,
      targetDir: args.targetDir ?? process.cwd(),
    };
  }

  const registry = await loadRegistry();
  const beEntry = getRegistryEntry(registry, "backend", addConfig.backend);

  // Determine the port — offset from base to avoid conflicts
  const existingServices = await countExistingServices(addConfig.targetDir);
  const port = beEntry.port + existingServices;

  p.log.step(chalk.bold("Adding service:"));
  p.log.info(`  Name:     ${addConfig.serviceName}`);
  p.log.info(`  Backend:  ${addConfig.backend} (${beEntry.lang})`);
  p.log.info(`  Port:     ${port}`);
  p.log.info(`  Into:     ${addConfig.targetDir}/${addConfig.serviceName}/`);

  // Create a ProjectConfig that targets the service subdirectory
  const serviceDir = path.join(addConfig.targetDir, addConfig.serviceName);
  const projectConfig = {
    name: addConfig.serviceName,
    type: "backend" as const,
    backend: addConfig.backend,
    enhancements: addConfig.enhancements,
    database: addConfig.database,
    targetDir: serviceDir,
  };

  // Scaffold the service
  await scaffold(projectConfig, registry);
  await runEnhancers(projectConfig, registry);

  // Update parent docker-compose.yml if it exists
  await updateDockerCompose(addConfig.targetDir, addConfig.serviceName, port);

  // Update parent Makefile if it exists
  await updateMakefile(addConfig.targetDir, addConfig.serviceName, beEntry);

  // Update parent CLAUDE.md if it exists
  await updateClaudeMd(addConfig.targetDir, addConfig.serviceName, addConfig.backend, port);

  p.outro(chalk.green(`Service "${addConfig.serviceName}" added!`));

  console.log();
  console.log(`  ${chalk.cyan("cd")} ${addConfig.serviceName}`);
  console.log(`  ${chalk.cyan(beEntry.devCmd)} ${chalk.gray("# start the service")}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function countExistingServices(projectRoot: string): Promise<number> {
  const composePath = path.join(projectRoot, "docker-compose.yml");
  if (await fs.pathExists(composePath)) {
    const content = await fs.readFile(composePath, "utf-8");
    // Count "build:" entries as a rough proxy for service count
    return (content.match(/\s+build:/g) || []).length;
  }
  return 0;
}

async function updateDockerCompose(
  projectRoot: string,
  serviceName: string,
  port: number,
): Promise<void> {
  const composePath = path.join(projectRoot, "docker-compose.yml");
  if (!(await fs.pathExists(composePath))) return;

  let compose = await fs.readFile(composePath, "utf-8");
  if (compose.includes(`  ${serviceName}:`)) return; // Already exists

  const serviceBlock = `  ${serviceName}:
    build: ./${serviceName}
    ports:
      - "${port}:${port}"
    env_file:
      - .env
    restart: unless-stopped
`;

  // Insert before volumes section
  if (compose.includes("\nvolumes:")) {
    compose = compose.replace("\nvolumes:", `${serviceBlock}\nvolumes:`);
  } else {
    compose += serviceBlock;
  }

  await fs.writeFile(composePath, compose);
  p.log.info("  Updated docker-compose.yml");
}

async function updateMakefile(
  projectRoot: string,
  serviceName: string,
  beEntry: { devCmd: string; testCmd: string },
): Promise<void> {
  const makefilePath = path.join(projectRoot, "Makefile");
  if (!(await fs.pathExists(makefilePath))) return;

  let makefile = await fs.readFile(makefilePath, "utf-8");
  if (makefile.includes(`${serviceName}-dev`)) return; // Already exists

  makefile += `
# --- ${serviceName} ---
${serviceName}-dev:
\tcd ${serviceName} && ${beEntry.devCmd}

${serviceName}-test:
\tcd ${serviceName} && ${beEntry.testCmd}
`;

  await fs.writeFile(makefilePath, makefile);
  p.log.info("  Updated Makefile");
}

async function updateClaudeMd(
  projectRoot: string,
  serviceName: string,
  backend: string,
  port: number,
): Promise<void> {
  const claudePath = path.join(projectRoot, "CLAUDE.md");
  if (!(await fs.pathExists(claudePath))) return;

  let content = await fs.readFile(claudePath, "utf-8");
  if (content.includes(serviceName)) return;

  content += `
## ${serviceName}

- **Stack:** ${backend}
- **Port:** ${port}
- **Directory:** \`${serviceName}/\`
- **Dev:** \`cd ${serviceName} && make dev\`
- **Test:** \`cd ${serviceName} && make test\`
`;

  await fs.writeFile(claudePath, content);
  p.log.info("  Updated CLAUDE.md");
}
