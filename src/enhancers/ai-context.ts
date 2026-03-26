import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, RegistryEntry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, PRIMARY_BACKEND_NAME } from "./utils.js";

// ---------------------------------------------------------------------------
// Shared content generators
// ---------------------------------------------------------------------------

function stackEntries(config: ProjectConfig, registry: Registry) {
  const entries: { label: string; entry: RegistryEntry; dir: string }[] = [];
  const { beDir, feDir } = resolveProjectDirs(config);
  const isFullstack = config.type === "fullstack";

  if (config.frontend) {
    entries.push({ label: "Frontend", entry: getRegistryEntry(registry, "frontend", config.frontend), dir: isFullstack ? "frontend/" : "./" });
  }
  if (config.backend) {
    entries.push({ label: "Backend (API)", entry: getRegistryEntry(registry, "backend", config.backend), dir: isFullstack ? `backend/${PRIMARY_BACKEND_NAME}/` : "./" });
  }
  if (config.mobile) {
    entries.push({ label: "Mobile", entry: getRegistryEntry(registry, "mobile", config.mobile), dir: isFullstack ? "mobile/" : "./" });
  }
  if (config.standalone) {
    entries.push({ label: "Stack", entry: getRegistryEntry(registry, "standalone", config.standalone), dir: "./" });
  }
  return entries;
}

function generateStructure(config: ProjectConfig): string {
  const isFullstack = config.type === "fullstack";
  let tree = `${config.name}/\n`;

  if (isFullstack) {
    tree += `  frontend/                    # Frontend application\n`;
    tree += `  backend/\n`;
    tree += `    ${PRIMARY_BACKEND_NAME}/                   # Primary backend service\n`;
    tree += `    <service-name>/            # Additional services (via 'add' command)\n`;
    if (config.mobile) tree += `  mobile/                      # Mobile application\n`;
  }

  tree += `  scripts/\n`;
  tree += `    setup.sh                   # Install all dependencies\n`;
  tree += `    dev.sh                     # Start dev servers\n`;
  tree += `    test.sh                    # Run all tests\n`;
  tree += `    lint.sh                    # Run linters\n`;
  tree += `    build.sh                   # Build for production\n`;
  if (config.enhancements.includes("doctor")) tree += `    doctor.sh                   # Check dev prerequisites\n`;
  if (config.enhancements.includes("deploy")) tree += `    deploy.sh                   # Deploy to configured platform\n`;
  tree += `  Makefile                     # Wraps scripts/ for convenience\n`;
  if (config.enhancements.includes("docker")) tree += `  docker-compose.yml            # All services\n`;
  if (config.enhancements.includes("observability")) tree += `  observability/                # Grafana, Prometheus, Tempo, Loki configs\n`;
  tree += `  .env.example                 # Environment variables template\n`;

  return tree;
}

function generateArchitecture(config: ProjectConfig, registry: Registry): string {
  if (config.type !== "fullstack") return "";

  const feEntry = config.frontend ? getRegistryEntry(registry, "frontend", config.frontend) : null;
  const beEntry = config.backend ? getRegistryEntry(registry, "backend", config.backend) : null;

  let s = `\n## Architecture\n\n`;
  s += "```\n";
  if (feEntry) s += `Browser → Frontend (:${feEntry.port})\n`;
  if (feEntry && beEntry) {
    if (config.enhancements.includes("api-wiring")) {
      s += `           ↓ /api/* proxy\n`;
    } else {
      s += `           ↓ fetch()\n`;
    }
  }
  if (beEntry) s += `         Backend (:${beEntry.port}) → backend/${PRIMARY_BACKEND_NAME}/\n`;
  if (config.enhancements.includes("db")) {
    const dbName = config.database ?? "postgres";
    s += `           ↓\n`;
    s += `         ${dbName}\n`;
  }
  s += "```\n";

  if (config.enhancements.includes("api-wiring")) {
    s += `\n**API wiring:** Frontend proxies \`/api/*\` to backend. The API client at \`frontend/src/lib/api.ts\` handles this.\n`;
  }
  if (config.enhancements.includes("sample-crud")) {
    s += `\n**Sample endpoints:** \`GET /api/items\`, \`POST /api/items\`, \`GET /api/items/:id\`, \`PUT /api/items/:id\`, \`DELETE /api/items/:id\` — with 5 seed items.\n`;
  }
  if (config.enhancements.includes("auth")) {
    s += `**Auth endpoints:** \`POST /api/auth/register\`, \`POST /api/auth/login\` — returns JWT tokens.\n`;
  }

  return s;
}

function generateEnvVars(config: ProjectConfig): string {
  const vars: string[] = [];
  if (config.enhancements.includes("db")) {
    const db = config.database ?? "postgres";
    if (db === "mongodb") vars.push("MONGODB_URI — MongoDB connection string", "MONGODB_DB — Database name");
    else vars.push("DATABASE_URL — Database connection string");
  }
  if (config.enhancements.includes("auth")) vars.push("JWT_SECRET — Secret for signing JWT tokens");
  if (config.enhancements.includes("observability")) vars.push("OTEL_SERVICE_NAME — Service name for traces/metrics", "OTEL_EXPORTER_OTLP_ENDPOINT — OpenTelemetry collector endpoint");
  if (config.enhancements.includes("analytics")) {
    const p = config.analyticsProvider ?? "posthog";
    vars.push(`${p.toUpperCase()}_API_KEY — Analytics provider API key`);
  }

  if (vars.length === 0) return "";
  return `\n## Environment Variables\n\nSee \`.env.example\` for all values. Key ones:\n${vars.map(v => `- \`${v.split(" — ")[0]}\` — ${v.split(" — ")[1]}`).join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// CLAUDE.md — Claude Code specific
// ---------------------------------------------------------------------------

function generateClaudeMd(config: ProjectConfig, registry: Registry): string {
  const entries = stackEntries(config, registry);
  const isFullstack = config.type === "fullstack";

  let s = `# ${config.name}\n\n`;

  // Overview
  s += `## Overview\n\n`;
  s += `- **Type:** ${config.type}\n`;
  for (const { label, entry, dir } of entries) {
    s += `- **${label}:** ${entry.name} (${entry.lang}) — \`${dir}\`\n`;
  }
  s += `\n`;

  // Structure
  s += `## Project Structure\n\n\`\`\`\n${generateStructure(config)}\`\`\`\n`;

  // Architecture
  s += generateArchitecture(config, registry);

  // Commands — imperative style for Claude
  s += `\n## Commands\n\n`;
  s += `Run these from the project root:\n`;
  s += `- \`make setup\` — install all dependencies\n`;
  s += `- \`make dev\` — start dev servers\n`;
  s += `- \`make test\` — run all tests\n`;
  s += `- \`make lint\` — lint + format\n`;
  s += `- \`make build\` — production build\n`;
  if (config.enhancements.includes("docker")) s += `- \`docker compose up\` — start all services via Docker\n`;
  if (config.enhancements.includes("doctor")) s += `- \`bash scripts/doctor.sh\` — check dev prerequisites\n`;

  // Stack-specific dev commands
  s += `\n## Dev Commands per Stack\n\n`;
  for (const { label, entry, dir } of entries) {
    s += `**${label}** (\`${dir}\`):\n`;
    s += `- Dev: \`${entry.devCmd}\`\n`;
    s += `- Test: \`${entry.testCmd}\`\n`;
    s += `- Build: \`${entry.buildCmd}\`\n\n`;
  }

  // How to add things
  s += `## How to Add...\n\n`;
  if (config.backend === "fastapi") {
    s += `### New FastAPI endpoint\n`;
    s += `1. Create \`backend/${PRIMARY_BACKEND_NAME}/app/routes/<name>.py\` with an \`APIRouter\`\n`;
    s += `2. Add \`from app.routes.<name> import router as <name>_router\` to \`backend/${PRIMARY_BACKEND_NAME}/app/main.py\`\n`;
    s += `3. Add \`app.include_router(<name>_router)\` after existing routers\n\n`;
  } else if (config.backend === "express") {
    s += `### New Express endpoint\n`;
    s += `1. Create \`backend/${PRIMARY_BACKEND_NAME}/src/routes/<name>.ts\` with a \`Router\`\n`;
    s += `2. Import and mount in \`backend/${PRIMARY_BACKEND_NAME}/src/index.ts\`: \`app.use("/api/<name>", router)\`\n\n`;
  }
  if (config.frontend === "react-vite") {
    s += `### New React component\nCreate \`frontend/src/components/<Name>.tsx\`\n\n`;
  }

  s += `### New backend service\n\`npx create-kickstart add <service-name> --backend <stack>\`\nAdds to \`backend/<service-name>/\`, updates docker-compose and Makefile.\n\n`;

  // Env vars
  s += generateEnvVars(config);

  // Conventions
  s += `\n## Conventions\n\n`;
  for (const { label, entry } of entries) {
    s += `- **${label}:** ${entry.lintConfig}`;
    if (entry.lintConfig === "ruff") s += ` (line length 100, rules: E,F,I,N,W,UP)`;
    if (entry.lintConfig === "eslint-prettier") s += ` (double quotes, semi, 2-space indent)`;
    s += `\n`;
  }

  return s;
}

// ---------------------------------------------------------------------------
// .cursorrules — Cursor specific (rules format)
// ---------------------------------------------------------------------------

function generateCursorRules(config: ProjectConfig, registry: Registry): string {
  const entries = stackEntries(config, registry);

  let s = `# Cursor Rules for ${config.name}\n\n`;
  s += `## Project Context\n\n`;
  s += `This is a ${config.type} project`;
  if (entries.length > 0) s += ` using ${entries.map(e => e.entry.name).join(" + ")}`;
  s += `.\n\n`;

  s += `## Code Style Rules\n\n`;
  for (const { label, entry } of entries) {
    if (entry.lintConfig === "eslint-prettier") {
      s += `### ${label} (TypeScript)\n`;
      s += `- Use double quotes, semicolons, 2-space indent\n`;
      s += `- Prefer \`const\` over \`let\`, never \`var\`\n`;
      s += `- Use TypeScript strict mode\n`;
      s += `- Imports: external packages first, then internal modules\n\n`;
    } else if (entry.lintConfig === "ruff") {
      s += `### ${label} (Python)\n`;
      s += `- Max line length: 100\n`;
      s += `- Use type hints on all function signatures\n`;
      s += `- Use \`async def\` for route handlers\n`;
      s += `- Imports: stdlib first, third-party second, local third\n\n`;
    } else if (entry.lintConfig === "golangci-lint") {
      s += `### ${label} (Go)\n`;
      s += `- Standard gofmt formatting\n`;
      s += `- Handle all errors explicitly\n`;
      s += `- Use structured logging (zerolog/slog)\n\n`;
    }
  }

  s += `## Project Structure Rules\n\n`;
  s += `- All backend services live in \`backend/\`\n`;
  s += `- Primary API is at \`backend/${PRIMARY_BACKEND_NAME}/\`\n`;
  s += `- Frontend is at \`frontend/\`\n`;
  s += `- Shared configs (.env, docker-compose, Makefile) are at project root\n`;
  s += `- Shell scripts in \`scripts/\` wrap all operations\n\n`;

  s += `## Command Shortcuts\n\n`;
  s += `- Setup: \`make setup\`\n`;
  s += `- Dev: \`make dev\`\n`;
  s += `- Test: \`make test\`\n`;
  s += `- Lint: \`make lint\`\n`;

  return s;
}

// ---------------------------------------------------------------------------
// .github/copilot.md — GitHub Copilot instructions
// ---------------------------------------------------------------------------

function generateCopilotMd(config: ProjectConfig, registry: Registry): string {
  const entries = stackEntries(config, registry);

  let s = `# GitHub Copilot Instructions for ${config.name}\n\n`;

  s += `## Context\n\n`;
  s += `${config.type} project: ${entries.map(e => `${e.entry.name} (${e.entry.lang})`).join(", ")}.\n\n`;

  s += `## File Locations\n\n`;
  for (const { label, entry, dir } of entries) {
    s += `- ${label}: \`${dir}\` (${entry.lang})\n`;
  }
  s += `\n`;

  s += `## Testing\n\n`;
  for (const { label, entry, dir } of entries) {
    s += `- ${label}: \`cd ${dir} && ${entry.testCmd}\`\n`;
  }
  s += `\n`;

  s += `## Style\n\n`;
  for (const { label, entry } of entries) {
    if (entry.lintConfig === "eslint-prettier") s += `- ${label}: ESLint + Prettier (double quotes, semi, 2-space)\n`;
    else if (entry.lintConfig === "ruff") s += `- ${label}: Ruff (line-length 100)\n`;
    else s += `- ${label}: ${entry.lintConfig}\n`;
  }

  return s;
}

// ---------------------------------------------------------------------------
// AI_CONTEXT.md — Generic (ChatGPT, etc.)
// ---------------------------------------------------------------------------

function generateGenericAiContext(config: ProjectConfig, registry: Registry): string {
  const entries = stackEntries(config, registry);

  let s = `# ${config.name} — AI Context\n\n`;
  s += `Use this file to understand the project when providing AI-assisted coding help.\n\n`;

  s += `## What is this project?\n\n`;
  s += `A ${config.type} application using ${entries.map(e => e.entry.name).join(" + ")}.\n\n`;

  s += `## Project Structure\n\n\`\`\`\n${generateStructure(config)}\`\`\`\n`;

  s += generateArchitecture(config, registry);

  s += `\n## Quick Reference\n\n`;
  s += `| Action | Command |\n|--------|--------|\n`;
  s += `| Install deps | \`make setup\` |\n`;
  s += `| Start dev | \`make dev\` |\n`;
  s += `| Run tests | \`make test\` |\n`;
  s += `| Lint | \`make lint\` |\n`;
  if (config.enhancements.includes("docker")) s += `| Docker | \`docker compose up\` |\n`;
  s += `\n`;

  s += `## Tech Stack Details\n\n`;
  for (const { label, entry, dir } of entries) {
    s += `- **${label}**: ${entry.name} (${entry.lang}) at \`${dir}\`, port ${entry.port || "N/A"}\n`;
  }

  s += generateEnvVars(config);

  return s;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceAiContext(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir } = config;

  const ghDir = path.join(targetDir, ".github");
  await fs.ensureDir(ghDir);

  // Generate tool-specific content in parallel
  await Promise.all([
    fs.writeFile(path.join(targetDir, "CLAUDE.md"), generateClaudeMd(config, registry)),
    fs.writeFile(path.join(targetDir, ".cursorrules"), generateCursorRules(config, registry)),
    fs.writeFile(path.join(targetDir, "AI_CONTEXT.md"), generateGenericAiContext(config, registry)),
    fs.writeFile(path.join(ghDir, "copilot.md"), generateCopilotMd(config, registry)),
  ]);
}
