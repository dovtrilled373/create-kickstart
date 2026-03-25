import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Vitest config for Vite-based frontends (not Next.js, not Angular)
// ---------------------------------------------------------------------------

const vitestConfig = `/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
`;

// ---------------------------------------------------------------------------
// Python conftest.py stub
// ---------------------------------------------------------------------------

const pythonConftest = `"""Shared fixtures for pytest."""

import pytest


@pytest.fixture
def app_client():
    """Override this fixture in your test modules as needed."""
    pass
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceTest(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  if (type === "fullstack") {
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      await ensureTestInfra(path.join(targetDir, "frontend"), config.frontend, feEntry.lang);
    }
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      await ensureTestInfra(path.join(targetDir, "backend"), config.backend, beEntry.lang);
    }
  } else {
    const { stackKey, lang, dir } = resolveStackInfo(config, registry, targetDir);
    await ensureTestInfra(dir, stackKey, lang);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureTestInfra(dir: string, stackKey: string, lang: string): Promise<void> {
  // Vitest config for Vite-based frontend projects (not Next.js, not Angular)
  const viteStacks = ["react-vite", "vue", "svelte"];
  if (viteStacks.includes(stackKey)) {
    const configPath = path.join(dir, "vitest.config.ts");
    if (!(await fs.pathExists(configPath))) {
      await fs.writeFile(configPath, vitestConfig);
    }
  }

  // Python: ensure tests/ dir + conftest.py
  if (lang === "python") {
    const testsDir = path.join(dir, "tests");
    await fs.ensureDir(testsDir);

    const conftestPath = path.join(testsDir, "conftest.py");
    if (!(await fs.pathExists(conftestPath))) {
      await fs.writeFile(conftestPath, pythonConftest);
    }

    // Ensure __init__.py exists in tests/
    const initPath = path.join(testsDir, "__init__.py");
    if (!(await fs.pathExists(initPath))) {
      await fs.writeFile(initPath, "");
    }
  }
}

function resolveStackInfo(
  config: ProjectConfig,
  registry: Registry,
  targetDir: string,
): { stackKey: string; lang: string; dir: string } {
  if (config.frontend) {
    const e = getRegistryEntry(registry, "frontend", config.frontend);
    return { stackKey: config.frontend, lang: e.lang, dir: targetDir };
  }
  if (config.backend) {
    const e = getRegistryEntry(registry, "backend", config.backend);
    return { stackKey: config.backend, lang: e.lang, dir: targetDir };
  }
  if (config.standalone) {
    const e = getRegistryEntry(registry, "standalone", config.standalone);
    return { stackKey: config.standalone, lang: e.lang, dir: targetDir };
  }
  throw new Error("No stack configured");
}
