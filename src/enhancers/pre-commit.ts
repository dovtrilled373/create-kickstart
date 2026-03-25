import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Pre-commit config for Python (ruff)
// ---------------------------------------------------------------------------

const preCommitConfigYaml = `repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.4
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
`;

// ---------------------------------------------------------------------------
// Git hook script
// ---------------------------------------------------------------------------

const gitHookScript = `#!/usr/bin/env bash
set -euo pipefail

echo "Running pre-commit lint..."
bash scripts/lint.sh
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhancePreCommit(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir } = config;

  // Check if any stack uses Python
  const hasPython = isPythonProject(config, registry);

  if (hasPython) {
    await fs.writeFile(
      path.join(targetDir, ".pre-commit-config.yaml"),
      preCommitConfigYaml,
    );
  }

  // Create .githooks/pre-commit for all projects
  const hooksDir = path.join(targetDir, ".githooks");
  await fs.ensureDir(hooksDir);

  const hookPath = path.join(hooksDir, "pre-commit");
  await fs.writeFile(hookPath, gitHookScript, { mode: 0o755 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPythonProject(config: ProjectConfig, registry: Registry): boolean {
  if (config.backend) {
    const be = getRegistryEntry(registry, "backend", config.backend);
    if (be.lang === "python") return true;
  }
  if (config.standalone) {
    const sa = getRegistryEntry(registry, "standalone", config.standalone);
    if (sa.lang === "python") return true;
  }
  return false;
}
