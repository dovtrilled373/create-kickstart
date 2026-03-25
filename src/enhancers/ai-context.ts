import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, RegistryEntry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Content generators
// ---------------------------------------------------------------------------

function generateOverview(config: ProjectConfig, registry: Registry): string {
  const stacks: string[] = [];

  if (config.frontend) {
    const fe = getRegistryEntry(registry, "frontend", config.frontend);
    stacks.push(`Frontend: ${fe.name} (port ${fe.port})`);
  }
  if (config.backend) {
    const be = getRegistryEntry(registry, "backend", config.backend);
    stacks.push(`Backend: ${be.name} (port ${be.port})`);
  }
  if (config.standalone) {
    const sa = getRegistryEntry(registry, "standalone", config.standalone);
    stacks.push(`Stack: ${sa.name}`);
  }

  return `# ${config.name}

## Project Overview

- **Type**: ${config.type}
${stacks.map((s) => `- **${s}**`).join("\n")}
- **Enhancements**: ${config.enhancements.length > 0 ? config.enhancements.join(", ") : "none"}
`;
}

function generateStructure(config: ProjectConfig): string {
  let tree = `\n## Project Structure\n\n\`\`\`\n${config.name}/\n`;

  if (config.type === "fullstack") {
    tree += `  frontend/          # Frontend application\n`;
    tree += `  backend/           # Backend API\n`;
  }

  tree += `  scripts/\n`;
  tree += `    setup.sh          # Install dependencies\n`;
  tree += `    dev.sh            # Start development servers\n`;
  tree += `    test.sh           # Run tests\n`;
  tree += `    lint.sh           # Run linters\n`;
  tree += `    build.sh          # Build for production\n`;
  tree += `  Makefile            # Make targets wrapping scripts/\n`;

  if (config.enhancements.includes("docker")) {
    tree += `  docker-compose.yml  # Docker services\n`;
  }
  if (config.enhancements.includes("ci")) {
    tree += `  .github/workflows/ # CI pipeline\n`;
  }
  if (config.enhancements.includes("env")) {
    tree += `  .env.example        # Environment template\n`;
  }

  tree += `\`\`\`\n`;
  return tree;
}

function generateCommands(): string {
  return `
## Commands

| Command        | Bash Equivalent       | Description               |
| -------------- | --------------------- | ------------------------- |
| \`make setup\`   | \`bash scripts/setup.sh\` | Install all dependencies  |
| \`make dev\`     | \`bash scripts/dev.sh\`   | Start dev servers         |
| \`make test\`    | \`bash scripts/test.sh\`  | Run all tests             |
| \`make lint\`    | \`bash scripts/lint.sh\`  | Run linters / formatters  |
| \`make build\`   | \`bash scripts/build.sh\` | Production build          |
`;
}

function generateTechStack(config: ProjectConfig, registry: Registry): string {
  let s = "\n## Tech Stack\n\n";

  if (config.frontend) {
    const fe = getRegistryEntry(registry, "frontend", config.frontend);
    s += `### Frontend: ${fe.name}\n`;
    s += `- Language: ${fe.lang}\n`;
    s += `- Port: ${fe.port}\n`;
    s += `- Dev: \`${fe.devCmd}\`\n`;
    s += `- Lint: ${fe.lintConfig}\n\n`;
  }

  if (config.backend) {
    const be = getRegistryEntry(registry, "backend", config.backend);
    s += `### Backend: ${be.name}\n`;
    s += `- Language: ${be.lang}\n`;
    s += `- Port: ${be.port}\n`;
    s += `- Dev: \`${be.devCmd}\`\n`;
    s += `- Lint: ${be.lintConfig}\n\n`;
  }

  if (config.standalone) {
    const sa = getRegistryEntry(registry, "standalone", config.standalone);
    s += `### ${sa.name}\n`;
    s += `- Language: ${sa.lang}\n`;
    if (sa.port > 0) s += `- Port: ${sa.port}\n`;
    s += `- Dev: \`${sa.devCmd}\`\n`;
    s += `- Lint: ${sa.lintConfig}\n\n`;
  }

  return s;
}

function generateConventions(config: ProjectConfig, registry: Registry): string {
  let s = "\n## Coding Conventions\n\n";

  const entries: { name: string; entry: RegistryEntry }[] = [];
  if (config.frontend) entries.push({ name: "Frontend", entry: getRegistryEntry(registry, "frontend", config.frontend) });
  if (config.backend) entries.push({ name: "Backend", entry: getRegistryEntry(registry, "backend", config.backend) });
  if (config.standalone) entries.push({ name: "Project", entry: getRegistryEntry(registry, "standalone", config.standalone) });

  for (const { name, entry } of entries) {
    s += `### ${name} (${entry.lintConfig})\n\n`;
    switch (entry.lintConfig) {
      case "ruff":
        s += `- Line length: 100\n`;
        s += `- Enabled rules: E, F, I, N, W, UP\n`;
        s += `- Auto-fix: \`ruff check . --fix\`\n`;
        break;
      case "eslint-prettier":
        s += `- Semicolons: yes\n`;
        s += `- Single quotes: no (double quotes)\n`;
        s += `- Tab width: 2\n`;
        s += `- Trailing commas: all\n`;
        break;
      case "golangci-lint":
        s += `- Standard Go formatting (gofmt)\n`;
        s += `- Linters: errcheck, gosimple, govet, staticcheck, unused\n`;
        break;
      case "checkstyle":
        s += `- Standard Java checkstyle rules\n`;
        break;
    }
    s += "\n";
  }

  return s;
}

function generateCommonTasks(config: ProjectConfig, registry: Registry): string {
  let s = "\n## Common Tasks\n\n";

  if (config.frontend) {
    switch (config.frontend) {
      case "nextjs":
        s += `### Adding a Next.js page\nCreate a new file in \`frontend/app/<route>/page.tsx\`.\n\n`;
        s += `### Adding an API route\nCreate \`frontend/app/api/<route>/route.ts\`.\n\n`;
        break;
      case "react-vite":
        s += `### Adding a React component\nCreate a new file in \`frontend/src/components/\`.\n\n`;
        break;
      case "vue":
        s += `### Adding a Vue component\nCreate a new \`.vue\` file in \`frontend/src/components/\`.\n\n`;
        s += `### Adding a route\nAdd the route to \`frontend/src/router/index.ts\`.\n\n`;
        break;
      case "svelte":
        s += `### Adding a SvelteKit route\nCreate \`frontend/src/routes/<path>/+page.svelte\`.\n\n`;
        break;
      case "angular":
        s += `### Adding an Angular component\nRun \`npx ng generate component <name>\` inside \`frontend/\`.\n\n`;
        break;
    }
  }

  if (config.backend) {
    switch (config.backend) {
      case "fastapi":
        s += `### Adding a FastAPI endpoint\nCreate a new router in \`backend/app/routers/\` and include it in \`backend/app/main.py\`.\n\n`;
        break;
      case "express":
      case "hono":
        s += `### Adding an API route\nCreate a new route handler in \`backend/src/routes/\` and register it in \`backend/src/index.ts\`.\n\n`;
        break;
      case "django":
        s += `### Adding a Django app\nRun \`python manage.py startapp <name>\` inside \`backend/\` and add to INSTALLED_APPS.\n\n`;
        break;
      case "go-chi":
        s += `### Adding a Go handler\nCreate a handler in \`backend/internal/handlers/\` and register the route in the router.\n\n`;
        break;
      case "spring-boot":
        s += `### Adding a Spring controller\nCreate a new \`@RestController\` class in the controllers package.\n\n`;
        break;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceAiContext(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir } = config;

  const content =
    generateOverview(config, registry) +
    generateStructure(config) +
    generateCommands() +
    generateTechStack(config, registry) +
    generateConventions(config, registry) +
    generateCommonTasks(config, registry);

  // Write all 4 AI context files
  await fs.writeFile(path.join(targetDir, "CLAUDE.md"), content);
  await fs.writeFile(path.join(targetDir, ".cursorrules"), content);
  await fs.writeFile(path.join(targetDir, "AI_CONTEXT.md"), content);

  // .github/copilot.md
  const ghDir = path.join(targetDir, ".github");
  await fs.ensureDir(ghDir);
  await fs.writeFile(path.join(ghDir, "copilot.md"), content);
}
