import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, RegistryEntry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { PRIMARY_BACKEND_NAME } from "./utils.js";

const BASH_HEADER = `#!/usr/bin/env bash
set -euo pipefail
`;

// ---------------------------------------------------------------------------
// Script generators
// ---------------------------------------------------------------------------

function setupScript(config: ProjectConfig, registry: Registry): string {
  let s = BASH_HEADER + `\necho "Setting up ${config.name}..."\n\n`;

  if (config.type === "fullstack") {
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      s += installCmd(fe, "frontend");
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      s += installCmd(be, `backend/${PRIMARY_BACKEND_NAME}`);
    }
  } else {
    const { entry } = resolveStack(config, registry);
    s += installCmd(entry);
  }

  s += `\n# Copy environment file\nif [ -f .env.example ] && [ ! -f .env ]; then\n  cp .env.example .env\n  echo "Created .env from .env.example"\nfi\n`;
  s += `\necho "Setup complete!"\n`;
  return s;
}

function devScript(config: ProjectConfig, registry: Registry): string {
  const hasDocker = config.enhancements.includes("docker");
  let s = BASH_HEADER + "\n";

  if (hasDocker) {
    s += `# Try docker compose first\nif command -v docker &>/dev/null && docker compose version &>/dev/null; then\n  echo "Starting with docker compose..."\n  docker compose up --build\n  exit 0\nfi\n\necho "Docker not available, starting services directly..."\n\n`;
  }

  if (config.type === "fullstack") {
    // Start both services in parallel with trap
    const cmds: string[] = [];
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      cmds.push(`(cd frontend && ${fe.devCmd})`);
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      cmds.push(`(cd backend/${PRIMARY_BACKEND_NAME} && ${be.devCmd})`);
    }

    s += `trap 'kill 0' EXIT\n\n`;
    for (let i = 0; i < cmds.length; i++) {
      s += `${cmds[i]} &\n`;
    }
    s += `\nwait\n`;
  } else {
    const { entry } = resolveStack(config, registry);
    s += `${entry.devCmd}\n`;
  }

  return s;
}

function testScript(config: ProjectConfig, registry: Registry): string {
  let s = BASH_HEADER + "\n";

  if (config.type === "fullstack") {
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      s += `echo "Running frontend tests..."\n(cd frontend && ${fe.testCmd})\n\n`;
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      s += `echo "Running backend tests..."\n(cd backend/${PRIMARY_BACKEND_NAME} && ${be.testCmd})\n\n`;
    }
  } else {
    const { entry } = resolveStack(config, registry);
    s += `${entry.testCmd}\n`;
  }

  return s;
}

function lintScript(config: ProjectConfig, registry: Registry): string {
  let s = BASH_HEADER + "\n";

  if (config.type === "fullstack") {
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      s += `echo "Linting frontend..."\n(cd frontend && ${lintCmd(fe)})\n\n`;
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      s += `echo "Linting backend..."\n(cd backend/${PRIMARY_BACKEND_NAME} && ${lintCmd(be)})\n\n`;
    }
  } else {
    const { entry } = resolveStack(config, registry);
    s += `${lintCmd(entry)}\n`;
  }

  return s;
}

function buildScript(config: ProjectConfig, registry: Registry): string {
  let s = BASH_HEADER + "\n";

  if (config.type === "fullstack") {
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      s += `echo "Building frontend..."\n(cd frontend && ${fe.buildCmd})\n\n`;
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      s += `echo "Building backend..."\n(cd backend/${PRIMARY_BACKEND_NAME} && ${be.buildCmd})\n\n`;
    }
  } else {
    const { entry } = resolveStack(config, registry);
    s += `${entry.buildCmd}\n`;
  }

  return s;
}

function makefile(): string {
  return `.PHONY: setup dev test lint build

setup:
\t@bash scripts/setup.sh

dev:
\t@bash scripts/dev.sh

test:
\t@bash scripts/test.sh

lint:
\t@bash scripts/lint.sh

build:
\t@bash scripts/build.sh
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceScripts(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir } = config;
  const scriptsDir = path.join(targetDir, "scripts");
  await fs.ensureDir(scriptsDir);

  const scripts: Record<string, string> = {
    "setup.sh": setupScript(config, registry),
    "dev.sh": devScript(config, registry),
    "test.sh": testScript(config, registry),
    "lint.sh": lintScript(config, registry),
    "build.sh": buildScript(config, registry),
  };

  for (const [filename, content] of Object.entries(scripts)) {
    const filePath = path.join(scriptsDir, filename);
    await fs.writeFile(filePath, content, { mode: 0o755 });
  }

  // Makefile at project root
  await fs.writeFile(path.join(targetDir, "Makefile"), makefile());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function installCmd(entry: RegistryEntry, subdir?: string): string {
  const cdPrefix = subdir ? `(cd ${subdir} && ` : "";
  const cdSuffix = subdir ? ")" : "";

  switch (entry.lang) {
    case "python":
      return `${cdPrefix}python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt${cdSuffix}\n`;
    case "go":
      return `${cdPrefix}go mod download${cdSuffix}\n`;
    case "java":
      return `${cdPrefix}./mvnw dependency:resolve${cdSuffix}\n`;
    default:
      return `${cdPrefix}npm install${cdSuffix}\n`;
  }
}

function lintCmd(entry: RegistryEntry): string {
  switch (entry.lintConfig) {
    case "ruff":
      return "ruff check . --fix";
    case "golangci-lint":
      return "golangci-lint run";
    case "checkstyle":
      return "./mvnw checkstyle:check";
    default:
      return "npx prettier --check . && npx eslint .";
  }
}

function resolveStack(
  config: ProjectConfig,
  registry: Registry,
): { entry: RegistryEntry; category: string } {
  if (config.frontend) {
    return { entry: getRegistryEntry(registry, "frontend", config.frontend), category: "frontend" };
  }
  if (config.backend) {
    return { entry: getRegistryEntry(registry, "backend", config.backend), category: "backend" };
  }
  if (config.standalone) {
    return { entry: getRegistryEntry(registry, "standalone", config.standalone), category: "standalone" };
  }
  throw new Error("No stack configured");
}
