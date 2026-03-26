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

function rustfmtToml(): string {
  return `edition = "2021"
max_width = 100
use_small_heuristics = "Max"
`;
}

function csharpEditorconfig(): string {
  return `# C# coding conventions
root = true

[*.cs]
indent_style = space
indent_size = 4
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# .NET style rules
dotnet_sort_system_directives_first = true
csharp_new_line_before_open_brace = all
csharp_indent_case_contents = true
csharp_style_var_for_built_in_types = true:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
`;
}

function elixirFormatterExs(): string {
  return `[
  inputs: ["{mix,.formatter}.exs", "{config,lib,test}/**/*.{ex,exs}"],
  line_length: 100
]
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
    case "clippy":
      await fs.writeFile(path.join(dir, "rustfmt.toml"), rustfmtToml());
      break;
    case "dotnet-format":
      await fs.writeFile(path.join(dir, ".editorconfig"), csharpEditorconfig());
      break;
    case "mix-format":
      await fs.writeFile(path.join(dir, ".formatter.exs"), elixirFormatterExs());
      break;
  }
}

function resolveEntry(config: ProjectConfig, registry: Registry) {
  if (config.frontend) return getRegistryEntry(registry, "frontend", config.frontend);
  if (config.backend) return getRegistryEntry(registry, "backend", config.backend);
  if (config.standalone) return getRegistryEntry(registry, "standalone", config.standalone);
  return null;
}
