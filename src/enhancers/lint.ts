import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Lint config content generators
// ---------------------------------------------------------------------------

function ruffToml(): string {
  return `# Ruff linter configuration
line-length = 100

[lint]
select = ["E", "F", "I", "N", "W", "UP"]
`;
}

function prettierRc(): string {
  return JSON.stringify(
    {
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "all",
      printWidth: 100,
    },
    null,
    2,
  ) + "\n";
}

function golangciYml(): string {
  return `run:
  timeout: 5m

linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceLint(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  if (type === "fullstack") {
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      await writeLintConfig(path.join(targetDir, "frontend"), feEntry.lintConfig);
    }
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      await writeLintConfig(path.join(targetDir, "backend"), beEntry.lintConfig);
    }
  } else {
    const entry = resolveEntry(config, registry);
    if (entry) {
      await writeLintConfig(targetDir, entry.lintConfig);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeLintConfig(dir: string, lintConfig: string): Promise<void> {
  await fs.ensureDir(dir);

  switch (lintConfig) {
    case "ruff":
      await fs.writeFile(path.join(dir, "ruff.toml"), ruffToml());
      break;
    case "eslint-prettier":
      await fs.writeFile(path.join(dir, ".prettierrc"), prettierRc());
      break;
    case "golangci-lint":
      await fs.writeFile(path.join(dir, ".golangci.yml"), golangciYml());
      break;
    case "checkstyle":
      // Spring Boot uses built-in checkstyle; no extra config needed
      break;
  }
}

function resolveEntry(config: ProjectConfig, registry: Registry) {
  if (config.frontend) return getRegistryEntry(registry, "frontend", config.frontend);
  if (config.backend) return getRegistryEntry(registry, "backend", config.backend);
  if (config.standalone) return getRegistryEntry(registry, "standalone", config.standalone);
  return null;
}
