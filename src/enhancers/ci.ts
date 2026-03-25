import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Job generators
// ---------------------------------------------------------------------------

function nodeJob(name: string, workingDir?: string): string {
  const wd = workingDir ? `\n        working-directory: ${workingDir}` : "";
  return `  ${name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm${workingDir ? `\n          cache-dependency-path: ${workingDir}/package-lock.json` : ""}
      - run: npm ci${wd}
      - run: npm run lint${wd}
      - run: npm test${wd}
      - run: npm run build${wd}
`;
}

function pythonJob(name: string, testCmd: string, workingDir?: string): string {
  const wd = workingDir ? `\n        working-directory: ${workingDir}` : "";
  return `  ${name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt${wd}
      - run: pip install ruff pytest${wd}
      - run: ruff check .${wd}
      - run: ${testCmd}${wd}
`;
}

function goJob(name: string, workingDir?: string): string {
  const wd = workingDir ? `\n        working-directory: ${workingDir}` : "";
  return `  ${name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - run: go vet ./...${wd}
      - run: go test ./...${wd}
`;
}

function javaJob(name: string, workingDir?: string): string {
  const wd = workingDir ? `\n        working-directory: ${workingDir}` : "";
  return `  ${name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
      - run: ./mvnw verify${wd}
`;
}

function jobForLang(name: string, lang: string, testCmd: string, workingDir?: string): string {
  switch (lang) {
    case "python":
      return pythonJob(name, testCmd, workingDir);
    case "go":
      return goJob(name, workingDir);
    case "java":
      return javaJob(name, workingDir);
    default:
      return nodeJob(name, workingDir);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceCi(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;
  const workflowDir = path.join(targetDir, ".github", "workflows");
  await fs.ensureDir(workflowDir);

  let yaml = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
`;

  if (type === "fullstack") {
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      yaml += jobForLang("frontend", feEntry.lang, feEntry.testCmd, "frontend");
    }
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      yaml += jobForLang("backend", beEntry.lang, beEntry.testCmd, "backend");
    }
  } else {
    const { stackKey, category, lang, testCmd } = resolveStackInfo(config, registry);
    yaml += jobForLang(category, lang, testCmd);
  }

  await fs.writeFile(path.join(workflowDir, "ci.yml"), yaml);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStackInfo(
  config: ProjectConfig,
  registry: Registry,
): { stackKey: string; category: string; lang: string; testCmd: string } {
  if (config.frontend) {
    const e = getRegistryEntry(registry, "frontend", config.frontend);
    return { stackKey: config.frontend, category: "frontend", lang: e.lang, testCmd: e.testCmd };
  }
  if (config.backend) {
    const e = getRegistryEntry(registry, "backend", config.backend);
    return { stackKey: config.backend, category: "backend", lang: e.lang, testCmd: e.testCmd };
  }
  if (config.standalone) {
    const e = getRegistryEntry(registry, "standalone", config.standalone);
    return { stackKey: config.standalone, category: "standalone", lang: e.lang, testCmd: e.testCmd };
  }
  throw new Error("No stack configured");
}
