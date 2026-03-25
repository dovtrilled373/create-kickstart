# create-kickstart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `create-kickstart`, an npm CLI that orchestrates official framework starters into composable multi-stack monorepo projects with opinionated enhancement packs (Docker, CI, linting, testing, env, AI context) and supports interactive, flag-based, and curl|bash execution modes.

**Architecture:** Three-phase orchestrator (Prompt → Scaffold → Enhance). The CLI reads a `registry.json` from GitHub at runtime to resolve framework starters. Enhancement packs are independent modules that inject files into the scaffolded project. Shell scripts normalize all commands across stacks.

**Tech Stack:** TypeScript, Node.js, @clack/prompts, execa, fs-extra, tsup, commander

---

### Task 1: Project Scaffolding & Build Pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `src/index.ts`
- Create: `.gitignore`
- Create: `.npmignore`

**Step 1: Initialize npm project**

```bash
cd /Users/swapnil/cookiecutter
npm init -y
```

Then replace `package.json` contents:

```json
{
  "name": "create-kickstart",
  "version": "0.1.0",
  "description": "Scaffold production-ready projects with composable multi-stack templates, AI context files, and uniform scripts",
  "type": "module",
  "bin": {
    "create-kickstart": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint src/ --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["scaffold", "template", "cli", "kickstart", "fullstack", "docker", "ai"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"]
}
```

**Step 2: Install dependencies**

```bash
npm install @clack/prompts commander execa fs-extra chalk
npm install -D typescript tsup vitest @types/node @types/fs-extra eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

**Step 5: Create minimal src/index.ts entrypoint**

```typescript
import { intro, outro } from "@clack/prompts";

intro("create-kickstart");
outro("Done! (skeleton)");
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
*.tgz
.env
.env.local
```

**Step 7: Build and test it runs**

```bash
npm run build && node dist/index.js
```

Expected: See clack intro/outro messages.

**Step 8: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts src/index.ts .gitignore .npmignore
git commit -m "feat: initialize create-kickstart CLI with build pipeline"
```

---

### Task 2: CLI Argument Parsing (Commander)

**Files:**
- Create: `src/cli.ts`
- Modify: `src/index.ts`
- Create: `src/types.ts`

**Step 1: Create src/types.ts with all shared types**

```typescript
export type ProjectType = "fullstack" | "frontend" | "backend" | "cli-lib";

export type FrontendStack = "nextjs" | "react-vite" | "vue" | "svelte" | "angular";
export type BackendStack = "fastapi" | "express" | "hono" | "django" | "go-chi" | "spring-boot";
export type StandaloneStack = "python-cli" | "python-lib" | "node-cli";

export type Enhancement =
  | "docker"
  | "ci"
  | "lint"
  | "test"
  | "env"
  | "ai-context"
  | "pre-commit"
  | "db";

export interface ProjectConfig {
  name: string;
  type: ProjectType;
  frontend?: FrontendStack;
  backend?: BackendStack;
  standalone?: StandaloneStack;
  enhancements: Enhancement[];
  targetDir: string;
}

export interface RegistryEntry {
  name: string;
  scaffoldCmd: string;
  scaffoldType?: "cli" | "template";
  port: number;
  lang: string;
  devCmd: string;
  buildCmd: string;
  testCmd: string;
  lintConfig: string;
}

export interface Registry {
  version: string;
  frontend: Record<string, RegistryEntry>;
  backend: Record<string, RegistryEntry>;
  standalone: Record<string, RegistryEntry>;
}
```

**Step 2: Create src/cli.ts — Commander setup with all flags**

```typescript
import { Command } from "commander";
import { ProjectConfig, Enhancement, ProjectType } from "./types.js";

export function parseArgs(argv: string[]): Partial<ProjectConfig> & { interactive: boolean } {
  const program = new Command();

  program
    .name("create-kickstart")
    .description("Scaffold production-ready projects with composable stacks")
    .version("0.1.0")
    .argument("[name]", "Project name")
    .option("--type <type>", "Project type: fullstack, frontend, backend, cli-lib")
    .option("--frontend <stack>", "Frontend stack: nextjs, react-vite, vue, svelte, angular")
    .option("--backend <stack>", "Backend stack: fastapi, express, hono, django, go-chi, spring-boot")
    .option("--standalone <stack>", "Standalone stack: python-cli, python-lib, node-cli")
    .option("--with <enhancements>", "Comma-separated enhancements: docker,ci,lint,test,env,ai-context,pre-commit,db")
    .option("--no-interactive", "Disable interactive prompts (for AI agents and scripts)")
    .parse(argv);

  const opts = program.opts();
  const args = program.args;

  const enhancements: Enhancement[] = opts.with
    ? opts.with.split(",").map((e: string) => e.trim() as Enhancement)
    : [];

  const isInteractive = opts.interactive !== false;

  return {
    name: args[0],
    type: opts.type as ProjectType | undefined,
    frontend: opts.frontend,
    backend: opts.backend,
    standalone: opts.standalone,
    enhancements,
    interactive: isInteractive,
  };
}
```

**Step 3: Wire into src/index.ts**

```typescript
import { intro, outro } from "@clack/prompts";
import { parseArgs } from "./cli.js";

const config = parseArgs(process.argv);

intro("create-kickstart");
console.log("Parsed config:", JSON.stringify(config, null, 2));
outro("Done! (skeleton)");
```

**Step 4: Build and test flags**

```bash
npm run build
node dist/index.js my-app --type fullstack --frontend nextjs --backend fastapi --with docker,ci,lint --no-interactive
```

Expected: JSON output showing all parsed flags.

**Step 5: Commit**

```bash
git add src/types.ts src/cli.ts src/index.ts
git commit -m "feat: add CLI argument parsing with commander"
```

---

### Task 3: Interactive Prompts (Clack)

**Files:**
- Create: `src/prompts.ts`
- Modify: `src/index.ts`

**Step 1: Create src/prompts.ts**

```typescript
import * as p from "@clack/prompts";
import { ProjectConfig, ProjectType, FrontendStack, BackendStack, StandaloneStack, Enhancement } from "./types.js";

export async function runPrompts(partial: Partial<ProjectConfig>): Promise<ProjectConfig> {
  const name =
    partial.name ??
    ((await p.text({
      message: "Project name:",
      placeholder: "my-app",
      validate: (v) => {
        if (!v) return "Name is required";
        if (!/^[a-z0-9-]+$/.test(v)) return "Use lowercase letters, numbers, hyphens only";
      },
    })) as string);

  if (p.isCancel(name)) process.exit(0);

  const type =
    partial.type ??
    ((await p.select({
      message: "What are you building?",
      options: [
        { value: "fullstack", label: "Fullstack", hint: "frontend/ + backend/ monorepo" },
        { value: "frontend", label: "Frontend only" },
        { value: "backend", label: "Backend / API only" },
        { value: "cli-lib", label: "CLI tool / Library" },
      ],
    })) as ProjectType);

  if (p.isCancel(type)) process.exit(0);

  let frontend: FrontendStack | undefined = partial.frontend;
  let backend: BackendStack | undefined = partial.backend;
  let standalone: StandaloneStack | undefined = partial.standalone;

  if ((type === "fullstack" || type === "frontend") && !frontend) {
    frontend = (await p.select({
      message: "Pick your frontend:",
      options: [
        { value: "nextjs", label: "Next.js", hint: "TypeScript, App Router" },
        { value: "react-vite", label: "React + Vite", hint: "TypeScript" },
        { value: "vue", label: "Vue 3 + Vite" },
        { value: "svelte", label: "Svelte + SvelteKit" },
        { value: "angular", label: "Angular" },
      ],
    })) as FrontendStack;
    if (p.isCancel(frontend)) process.exit(0);
  }

  if ((type === "fullstack" || type === "backend") && !backend) {
    backend = (await p.select({
      message: "Pick your backend:",
      options: [
        { value: "fastapi", label: "FastAPI", hint: "Python" },
        { value: "express", label: "Express", hint: "TypeScript" },
        { value: "hono", label: "Hono", hint: "TypeScript, lightweight" },
        { value: "django", label: "Django", hint: "Python" },
        { value: "go-chi", label: "Go (Chi)", hint: "Go" },
        { value: "spring-boot", label: "Spring Boot", hint: "Java" },
      ],
    })) as BackendStack;
    if (p.isCancel(backend)) process.exit(0);
  }

  if (type === "cli-lib" && !standalone) {
    standalone = (await p.select({
      message: "Pick your stack:",
      options: [
        { value: "python-cli", label: "Python CLI (Click)" },
        { value: "python-lib", label: "Python Library" },
        { value: "node-cli", label: "Node.js CLI", hint: "TypeScript" },
      ],
    })) as StandaloneStack;
    if (p.isCancel(standalone)) process.exit(0);
  }

  const enhancements =
    partial.enhancements.length > 0
      ? partial.enhancements
      : ((await p.multiselect({
          message: "Select enhancements:",
          options: [
            { value: "docker", label: "Docker + Docker Compose", hint: "Recommended" },
            { value: "ci", label: "CI (GitHub Actions)", hint: "Recommended" },
            { value: "lint", label: "Linting + Formatting", hint: "Recommended" },
            { value: "test", label: "Testing scaffold", hint: "Recommended" },
            { value: "env", label: ".env management", hint: "Recommended" },
            { value: "ai-context", label: "AI context files", hint: "CLAUDE.md, .cursorrules, etc." },
            { value: "pre-commit", label: "Pre-commit hooks" },
            { value: "db", label: "Database (Postgres)", hint: "via Docker" },
          ],
          initialValues: ["docker", "ci", "lint", "test", "env", "ai-context"],
        })) as Enhancement[]);

  if (p.isCancel(enhancements)) process.exit(0);

  const targetDir = `${process.cwd()}/${name}`;

  return { name, type, frontend, backend, standalone, enhancements, targetDir };
}
```

**Step 2: Update src/index.ts to wire prompts**

```typescript
import * as p from "@clack/prompts";
import { parseArgs } from "./cli.js";
import { runPrompts } from "./prompts.js";

async function main() {
  p.intro("create-kickstart");

  const args = parseArgs(process.argv);

  let config;
  if (args.interactive) {
    config = await runPrompts(args);
  } else {
    // Non-interactive: validate required flags
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
      enhancements: args.enhancements?.length ? args.enhancements : ["docker", "ci", "lint", "test", "env", "ai-context"],
      targetDir: `${process.cwd()}/${args.name}`,
    };
  }

  p.log.info(`Project: ${config.name}`);
  p.log.info(`Type: ${config.type}`);
  if (config.frontend) p.log.info(`Frontend: ${config.frontend}`);
  if (config.backend) p.log.info(`Backend: ${config.backend}`);
  p.log.info(`Enhancements: ${config.enhancements.join(", ")}`);

  p.outro("Config ready — scaffolding coming next!");
}

main().catch(console.error);
```

**Step 3: Build and test interactive mode**

```bash
npm run build && node dist/index.js
```

Expected: Interactive prompts appear, user can select options.

**Step 4: Commit**

```bash
git add src/prompts.ts src/index.ts
git commit -m "feat: add interactive prompts with @clack/prompts"
```

---

### Task 4: Registry System

**Files:**
- Create: `src/registry.ts`
- Create: `registry.json` (at project root — this is what gets hosted on GH)

**Step 1: Create registry.json**

```json
{
  "version": "1.0.0",
  "frontend": {
    "nextjs": {
      "name": "Next.js",
      "scaffoldCmd": "npx create-next-app@latest {{name}} --ts --app --use-npm --no-import-alias --eslint --no-tailwind --no-src-dir",
      "scaffoldType": "cli",
      "port": 3000,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npm test",
      "lintConfig": "eslint-prettier"
    },
    "react-vite": {
      "name": "React + Vite",
      "scaffoldCmd": "npm create vite@latest {{name}} -- --template react-ts",
      "scaffoldType": "cli",
      "port": 5173,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npx vitest run",
      "lintConfig": "eslint-prettier"
    },
    "vue": {
      "name": "Vue 3 + Vite",
      "scaffoldCmd": "npm create vue@latest {{name}} -- --ts --router --pinia",
      "scaffoldType": "cli",
      "port": 5173,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npm test",
      "lintConfig": "eslint-prettier"
    },
    "svelte": {
      "name": "SvelteKit",
      "scaffoldCmd": "npx sv create {{name}} --template minimal --types ts",
      "scaffoldType": "cli",
      "port": 5173,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npm test",
      "lintConfig": "eslint-prettier"
    },
    "angular": {
      "name": "Angular",
      "scaffoldCmd": "npx @angular/cli@latest new {{name}} --skip-git --style css --ssr false",
      "scaffoldType": "cli",
      "port": 4200,
      "lang": "typescript",
      "devCmd": "npx ng serve",
      "buildCmd": "npx ng build",
      "testCmd": "npx ng test --watch=false",
      "lintConfig": "eslint-prettier"
    }
  },
  "backend": {
    "fastapi": {
      "name": "FastAPI",
      "scaffoldType": "template",
      "port": 8000,
      "lang": "python",
      "devCmd": "uvicorn app.main:app --reload --port 8000",
      "buildCmd": "echo 'No build step required'",
      "testCmd": "pytest -v",
      "lintConfig": "ruff"
    },
    "express": {
      "name": "Express",
      "scaffoldType": "template",
      "port": 3001,
      "lang": "typescript",
      "devCmd": "npx tsx watch src/index.ts",
      "buildCmd": "npx tsc",
      "testCmd": "npx vitest run",
      "lintConfig": "eslint-prettier"
    },
    "hono": {
      "name": "Hono",
      "scaffoldCmd": "npm create hono@latest {{name}}",
      "scaffoldType": "cli",
      "port": 3001,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npx vitest run",
      "lintConfig": "eslint-prettier"
    },
    "django": {
      "name": "Django",
      "scaffoldCmd": "pip install django && django-admin startproject {{name}} {{name}}",
      "scaffoldType": "cli",
      "port": 8000,
      "lang": "python",
      "devCmd": "python manage.py runserver 0.0.0.0:8000",
      "buildCmd": "python manage.py collectstatic --noinput",
      "testCmd": "python manage.py test",
      "lintConfig": "ruff"
    },
    "go-chi": {
      "name": "Go (Chi)",
      "scaffoldType": "template",
      "port": 8080,
      "lang": "go",
      "devCmd": "go run ./cmd/server",
      "buildCmd": "go build -o bin/server ./cmd/server",
      "testCmd": "go test ./...",
      "lintConfig": "golangci-lint"
    },
    "spring-boot": {
      "name": "Spring Boot",
      "scaffoldType": "template",
      "port": 8080,
      "lang": "java",
      "devCmd": "./mvnw spring-boot:run",
      "buildCmd": "./mvnw package -DskipTests",
      "testCmd": "./mvnw test",
      "lintConfig": "checkstyle"
    }
  },
  "standalone": {
    "python-cli": {
      "name": "Python CLI (Click)",
      "scaffoldType": "template",
      "port": 0,
      "lang": "python",
      "devCmd": "python -m {{name}}",
      "buildCmd": "pip install build && python -m build",
      "testCmd": "pytest -v",
      "lintConfig": "ruff"
    },
    "python-lib": {
      "name": "Python Library",
      "scaffoldType": "template",
      "port": 0,
      "lang": "python",
      "devCmd": "pip install -e '.[dev]'",
      "buildCmd": "pip install build && python -m build",
      "testCmd": "pytest -v",
      "lintConfig": "ruff"
    },
    "node-cli": {
      "name": "Node.js CLI",
      "scaffoldType": "template",
      "port": 0,
      "lang": "typescript",
      "devCmd": "npx tsx watch src/index.ts",
      "buildCmd": "npx tsup",
      "testCmd": "npx vitest run",
      "lintConfig": "eslint-prettier"
    }
  }
}
```

**Step 2: Create src/registry.ts**

```typescript
import { Registry } from "./types.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/swapnil/create-kickstart/main/registry.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadRegistry(): Promise<Registry> {
  // Try remote first, fall back to local bundled copy
  try {
    const response = await fetch(REGISTRY_URL);
    if (response.ok) {
      return (await response.json()) as Registry;
    }
  } catch {
    // Network error — fall back to local
  }

  // Fallback: read from bundled registry.json
  const localPath = join(__dirname, "..", "registry.json");
  const data = readFileSync(localPath, "utf-8");
  return JSON.parse(data) as Registry;
}

export function getRegistryEntry(registry: Registry, category: string, key: string) {
  const cat = registry[category as keyof Omit<Registry, "version">];
  if (!cat || !cat[key]) {
    throw new Error(`Unknown ${category} stack: ${key}`);
  }
  return cat[key];
}
```

**Step 3: Commit**

```bash
git add registry.json src/registry.ts
git commit -m "feat: add registry system with remote fetch and local fallback"
```

---

### Task 5: Scaffold Orchestrator

**Files:**
- Create: `src/scaffold.ts`
- Create: `src/templates/fastapi/app/main.py`
- Create: `src/templates/fastapi/app/__init__.py`
- Create: `src/templates/fastapi/requirements.txt`
- Create: `src/templates/express/src/index.ts`
- Create: `src/templates/express/package.json`
- Create: `src/templates/go-chi/cmd/server/main.go`
- Create: `src/templates/go-chi/go.mod`

This is the core engine. It calls official CLIs for `scaffoldType: "cli"` stacks and copies template files for `scaffoldType: "template"` stacks.

**Step 1: Create src/scaffold.ts**

```typescript
import * as p from "@clack/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { ProjectConfig, RegistryEntry, Registry } from "./types.js";
import { getRegistryEntry } from "./registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, "..", "src", "templates");

function replaceVars(str: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (s, [key, val]) => s.replaceAll(`{{${key}}}`, val),
    str
  );
}

async function scaffoldViaCli(
  cmd: string,
  name: string,
  destDir: string
): Promise<void> {
  const resolved = cmd.replaceAll("{{name}}", name);
  const [bin, ...args] = resolved.split(" ");

  const spinner = p.spinner();
  spinner.start(`Running: ${bin} ${args.slice(0, 3).join(" ")}...`);

  try {
    await execa(bin, args, {
      cwd: path.dirname(destDir),
      stdio: "pipe",
    });
    spinner.stop(`Scaffolded with ${bin}`);
  } catch (err: any) {
    spinner.stop(`Failed: ${err.message}`);
    throw err;
  }
}

async function scaffoldViaTemplate(
  stack: string,
  name: string,
  destDir: string,
  vars: Record<string, string>
): Promise<void> {
  const templateDir = path.join(TEMPLATES_DIR, stack);
  const spinner = p.spinner();
  spinner.start(`Creating ${stack} from template...`);

  if (await fs.pathExists(templateDir)) {
    await fs.copy(templateDir, destDir);

    // Replace template vars in all files
    const files = await getAllFiles(destDir);
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const replaced = replaceVars(content, vars);
      if (replaced !== content) {
        await fs.writeFile(file, replaced);
      }
    }
  } else {
    // Create minimal structure if no template exists
    await fs.ensureDir(destDir);
  }

  spinner.stop(`Created ${stack} project`);
}

async function getAllFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

export async function scaffold(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const vars = {
    name: config.name,
    PROJECT_NAME: config.name,
  };

  await fs.ensureDir(config.targetDir);

  if (config.type === "fullstack") {
    // --- Frontend ---
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      const frontendDir = path.join(config.targetDir, "frontend");

      if (entry.scaffoldType === "cli" && entry.scaffoldCmd) {
        // CLI scaffolders create the dir, so we scaffold into parent then rename
        await scaffoldViaCli(entry.scaffoldCmd, "frontend", frontendDir);
      } else {
        await scaffoldViaTemplate(config.frontend, "frontend", frontendDir, vars);
      }
    }

    // --- Backend ---
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      const backendDir = path.join(config.targetDir, "backend");

      if (entry.scaffoldType === "cli" && entry.scaffoldCmd) {
        await scaffoldViaCli(entry.scaffoldCmd, "backend", backendDir);
      } else {
        await scaffoldViaTemplate(config.backend, "backend", backendDir, vars);
      }
    }
  } else if (config.type === "frontend" && config.frontend) {
    const entry = getRegistryEntry(registry, "frontend", config.frontend);
    if (entry.scaffoldType === "cli" && entry.scaffoldCmd) {
      await scaffoldViaCli(entry.scaffoldCmd, config.name, config.targetDir);
    } else {
      await scaffoldViaTemplate(config.frontend, config.name, config.targetDir, vars);
    }
  } else if (config.type === "backend" && config.backend) {
    const entry = getRegistryEntry(registry, "backend", config.backend);
    if (entry.scaffoldType === "cli" && entry.scaffoldCmd) {
      await scaffoldViaCli(entry.scaffoldCmd, config.name, config.targetDir);
    } else {
      await scaffoldViaTemplate(config.backend, config.name, config.targetDir, vars);
    }
  } else if (config.type === "cli-lib" && config.standalone) {
    await scaffoldViaTemplate(config.standalone, config.name, config.targetDir, vars);
  }
}
```

**Step 2: Create backend template files for FastAPI**

File: `src/templates/fastapi/app/__init__.py` — empty file

File: `src/templates/fastapi/app/main.py`:
```python
from fastapi import FastAPI

app = FastAPI(title="{{PROJECT_NAME}}")


@app.get("/")
async def root():
    return {"message": "Hello from {{PROJECT_NAME}}"}


@app.get("/health")
async def health():
    return {"status": "ok"}
```

File: `src/templates/fastapi/requirements.txt`:
```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

File: `src/templates/fastapi/tests/__init__.py` — empty file

File: `src/templates/fastapi/tests/test_main.py`:
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

**Step 3: Create backend template files for Express**

File: `src/templates/express/package.json`:
```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "dotenv": "^16.4.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/node": "^22.0.0",
    "vitest": "^3.0.0"
  }
}
```

File: `src/templates/express/src/index.ts`:
```typescript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Hello from {{PROJECT_NAME}}" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

File: `src/templates/express/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create backend template files for Go (Chi)**

File: `src/templates/go-chi/go.mod`:
```
module {{PROJECT_NAME}}

go 1.22

require github.com/go-chi/chi/v5 v5.1.0
```

File: `src/templates/go-chi/cmd/server/main.go`:
```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"message": "Hello from {{PROJECT_NAME}}"})
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
```

**Step 5: Commit**

```bash
git add src/scaffold.ts src/templates/
git commit -m "feat: add scaffold orchestrator with FastAPI, Express, Go templates"
```

---

### Task 6: Enhancement Packs

**Files:**
- Create: `src/enhancers/index.ts`
- Create: `src/enhancers/docker.ts`
- Create: `src/enhancers/ci.ts`
- Create: `src/enhancers/lint.ts`
- Create: `src/enhancers/test.ts`
- Create: `src/enhancers/env.ts`
- Create: `src/enhancers/ai-context.ts`
- Create: `src/enhancers/scripts.ts`
- Create: `src/enhancers/pre-commit.ts`
- Create: `src/enhancers/db.ts`

Each enhancer is a function: `(config: ProjectConfig, registry: Registry) => Promise<void>` that writes files into `config.targetDir`.

**Step 1: Create src/enhancers/index.ts — dispatcher**

```typescript
import { ProjectConfig, Registry, Enhancement } from "../types.js";
import { enhanceDocker } from "./docker.js";
import { enhanceCi } from "./ci.js";
import { enhanceLint } from "./lint.js";
import { enhanceTest } from "./test.js";
import { enhanceEnv } from "./env.js";
import { enhanceAiContext } from "./ai-context.js";
import { enhanceScripts } from "./scripts.js";
import { enhancePreCommit } from "./pre-commit.js";
import { enhanceDb } from "./db.js";
import * as p from "@clack/prompts";

type Enhancer = (config: ProjectConfig, registry: Registry) => Promise<void>;

const ENHANCER_MAP: Record<Enhancement, Enhancer> = {
  docker: enhanceDocker,
  ci: enhanceCi,
  lint: enhanceLint,
  test: enhanceTest,
  env: enhanceEnv,
  "ai-context": enhanceAiContext,
  "pre-commit": enhancePreCommit,
  db: enhanceDb,
};

export async function runEnhancers(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  // Scripts are always generated
  await enhanceScripts(config, registry);

  for (const enh of config.enhancements) {
    const enhancer = ENHANCER_MAP[enh];
    if (enhancer) {
      const spinner = p.spinner();
      spinner.start(`Applying ${enh} enhancement...`);
      await enhancer(config, registry);
      spinner.stop(`Applied ${enh}`);
    }
  }
}
```

**Step 2: Create src/enhancers/docker.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

function nodejsDockerfile(port: number): string {
  return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE ${port}
CMD ["node", "dist/index.js"]
`;
}

function pythonDockerfile(port: number): string {
  return `FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${port}
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`;
}

function goDockerfile(port: number): string {
  return `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/server ./cmd/server

FROM alpine:3.19
COPY --from=builder /bin/server /bin/server
EXPOSE ${port}
CMD ["/bin/server"]
`;
}

function getDockerfile(lang: string, port: number): string {
  switch (lang) {
    case "python": return pythonDockerfile(port);
    case "go": return goDockerfile(port);
    case "java": return `FROM eclipse-temurin:21-jdk-alpine\nWORKDIR /app\nCOPY . .\nRUN ./mvnw package -DskipTests\nEXPOSE ${port}\nCMD ["java", "-jar", "target/*.jar"]\n`;
    default: return nodejsDockerfile(port);
  }
}

export async function enhanceDocker(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const services: Record<string, any> = {};
  const dockerignore = `node_modules\ndist\n.env\n.env.local\n__pycache__\n*.pyc\n.git\n`;

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      const dir = path.join(config.targetDir, "frontend");
      await fs.writeFile(path.join(dir, "Dockerfile"), getDockerfile(entry.lang, entry.port));
      await fs.writeFile(path.join(dir, ".dockerignore"), dockerignore);
      services.frontend = {
        build: { context: "./frontend", dockerfile: "Dockerfile" },
        ports: [`${entry.port}:${entry.port}`],
        volumes: ["./frontend:/app", "/app/node_modules"],
        environment: ["NODE_ENV=development"],
      };
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      const dir = path.join(config.targetDir, "backend");
      await fs.writeFile(path.join(dir, "Dockerfile"), getDockerfile(entry.lang, entry.port));
      await fs.writeFile(path.join(dir, ".dockerignore"), dockerignore);
      services.backend = {
        build: { context: "./backend", dockerfile: "Dockerfile" },
        ports: [`${entry.port}:${entry.port}`],
        volumes: [`./backend:/app`],
        env_file: [".env"],
      };
    }
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      await fs.writeFile(path.join(config.targetDir, "Dockerfile"), getDockerfile(entry.lang, entry.port));
      await fs.writeFile(path.join(config.targetDir, ".dockerignore"), dockerignore);
      services.app = {
        build: ".",
        ports: [`${entry.port}:${entry.port}`],
        env_file: [".env"],
      };
    }
  }

  // docker-compose.yml
  const compose: any = { version: "3.8", services };

  if (config.enhancements.includes("db")) {
    services.db = {
      image: "postgres:16-alpine",
      ports: ["5432:5432"],
      environment: {
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_DB: config.name.replace(/-/g, "_"),
      },
      volumes: ["pgdata:/var/lib/postgresql/data"],
    };
    compose.volumes = { pgdata: {} };

    // Add depends_on to backend
    if (services.backend) {
      services.backend.depends_on = ["db"];
    } else if (services.app) {
      services.app.depends_on = ["db"];
    }
  }

  const yamlContent = generateSimpleYaml(compose);
  await fs.writeFile(path.join(config.targetDir, "docker-compose.yml"), yamlContent);
}

function generateSimpleYaml(obj: any, indent = 0): string {
  // Simple YAML generator — good enough for docker-compose
  const pad = "  ".repeat(indent);
  let out = "";

  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      out += `${pad}${key}:\n`;
      for (const item of val) {
        if (typeof item === "object") {
          out += `${pad}  -\n`;
          out += generateSimpleYaml(item, indent + 2);
        } else {
          out += `${pad}  - "${item}"\n`;
        }
      }
    } else if (typeof val === "object") {
      out += `${pad}${key}:\n`;
      out += generateSimpleYaml(val, indent + 1);
    } else {
      out += `${pad}${key}: ${val}\n`;
    }
  }
  return out;
}
```

**Step 3: Create src/enhancers/ci.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceCi(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const workflowDir = path.join(config.targetDir, ".github", "workflows");
  await fs.ensureDir(workflowDir);

  const jobs: string[] = [];

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      jobs.push(getFrontendJob(entry.lang));
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      jobs.push(getBackendJob(entry.lang, entry.testCmd));
    }
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      if (entry.lang === "python") {
        jobs.push(getBackendJob("python", entry.testCmd));
      } else if (entry.lang === "go") {
        jobs.push(getBackendJob("go", entry.testCmd));
      } else {
        jobs.push(getFrontendJob(entry.lang));
      }
    }
  }

  const workflow = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

${jobs.join("\n")}
`;

  await fs.writeFile(path.join(workflowDir, "ci.yml"), workflow);
}

function getFrontendJob(lang: string): string {
  return `jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run build`;
}

function getBackendJob(lang: string, testCmd: string): string {
  if (lang === "python") {
    return `  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pip install pytest ruff
      - run: ruff check .
      - run: ${testCmd}`;
  }
  if (lang === "go") {
    return `  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - run: go vet ./...
      - run: ${testCmd}`;
  }
  // TypeScript backend
  return `  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present`;
}
```

**Step 4: Create src/enhancers/env.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceEnv(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const envLines: string[] = [
    `# ${config.name} environment variables`,
    `# Copy this file to .env and fill in the values`,
    ``,
    `NODE_ENV=development`,
  ];

  if (config.frontend) {
    const entry = getRegistryEntry(registry, "frontend", config.frontend);
    envLines.push(``, `# Frontend`, `FRONTEND_PORT=${entry.port}`);
  }

  if (config.backend) {
    const entry = getRegistryEntry(registry, "backend", config.backend);
    envLines.push(``, `# Backend`, `BACKEND_PORT=${entry.port}`, `API_URL=http://localhost:${entry.port}`);
  }

  if (config.enhancements.includes("db")) {
    envLines.push(
      ``,
      `# Database`,
      `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${config.name.replace(/-/g, "_")}`,
      `POSTGRES_USER=postgres`,
      `POSTGRES_PASSWORD=postgres`,
      `POSTGRES_DB=${config.name.replace(/-/g, "_")}`
    );
  }

  const envContent = envLines.join("\n") + "\n";

  await fs.writeFile(path.join(config.targetDir, ".env.example"), envContent);
  await fs.writeFile(path.join(config.targetDir, ".env"), envContent);

  // Ensure .env is in .gitignore
  const gitignorePath = path.join(config.targetDir, ".gitignore");
  let gitignore = "";
  if (await fs.pathExists(gitignorePath)) {
    gitignore = await fs.readFile(gitignorePath, "utf-8");
  }
  if (!gitignore.includes(".env")) {
    gitignore += "\n# Environment\n.env\n.env.local\n.env.*.local\n";
    await fs.writeFile(gitignorePath, gitignore);
  }
}
```

**Step 5: Create src/enhancers/lint.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceLint(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const dirs = getProjectDirs(config);

  for (const { dir, category, stack } of dirs) {
    const entry = getRegistryEntry(registry, category, stack);

    if (entry.lintConfig === "ruff") {
      await writeRuffConfig(dir);
    } else if (entry.lintConfig === "eslint-prettier") {
      await writeEslintPrettier(dir);
    } else if (entry.lintConfig === "golangci-lint") {
      await writeGolangciLint(dir);
    }
  }
}

function getProjectDirs(config: ProjectConfig) {
  const dirs: Array<{ dir: string; category: string; stack: string }> = [];

  if (config.type === "fullstack") {
    if (config.frontend)
      dirs.push({ dir: path.join(config.targetDir, "frontend"), category: "frontend", stack: config.frontend });
    if (config.backend)
      dirs.push({ dir: path.join(config.targetDir, "backend"), category: "backend", stack: config.backend });
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) dirs.push({ dir: config.targetDir, category, stack });
  }
  return dirs;
}

async function writeRuffConfig(dir: string): Promise<void> {
  const config = `[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]

[tool.ruff.format]
quote-style = "double"
`;
  // Write as ruff.toml or append to pyproject.toml
  await fs.writeFile(path.join(dir, "ruff.toml"), config);
}

async function writeEslintPrettier(dir: string): Promise<void> {
  const prettier = `{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`;
  await fs.writeFile(path.join(dir, ".prettierrc"), prettier);
}

async function writeGolangciLint(dir: string): Promise<void> {
  const config = `linters:
  enable:
    - gofmt
    - govet
    - errcheck
    - staticcheck
    - unused
    - gosimple
    - ineffassign
`;
  await fs.writeFile(path.join(dir, ".golangci.yml"), config);
}
```

**Step 6: Create src/enhancers/test.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";

export async function enhanceTest(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  // Test scaffolding is largely handled by the templates themselves
  // This enhancer ensures test configs exist

  if (config.type === "fullstack" || config.type === "frontend") {
    if (config.frontend) {
      const dir =
        config.type === "fullstack"
          ? path.join(config.targetDir, "frontend")
          : config.targetDir;

      // Vitest config for Vite-based projects
      if (config.frontend !== "nextjs" && config.frontend !== "angular") {
        const vitestConfig = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
  },
});
`;
        await fs.writeFile(path.join(dir, "vitest.config.ts"), vitestConfig);
      }
    }
  }

  if (config.type === "fullstack" || config.type === "backend") {
    if (config.backend) {
      const dir =
        config.type === "fullstack"
          ? path.join(config.targetDir, "backend")
          : config.targetDir;

      const testsDir = path.join(dir, "tests");
      await fs.ensureDir(testsDir);

      // Ensure conftest.py for Python projects
      if (["fastapi", "django"].includes(config.backend)) {
        const conftest = path.join(testsDir, "conftest.py");
        if (!(await fs.pathExists(conftest))) {
          await fs.writeFile(conftest, '"""Test configuration."""\n');
        }
      }
    }
  }
}
```

**Step 7: Create src/enhancers/scripts.ts — the uniform shell scripts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceScripts(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const scriptsDir = path.join(config.targetDir, "scripts");
  await fs.ensureDir(scriptsDir);

  const useDocker = config.enhancements.includes("docker");

  await fs.writeFile(path.join(scriptsDir, "setup.sh"), generateSetupScript(config, registry));
  await fs.writeFile(path.join(scriptsDir, "dev.sh"), generateDevScript(config, registry, useDocker));
  await fs.writeFile(path.join(scriptsDir, "test.sh"), generateTestScript(config, registry));
  await fs.writeFile(path.join(scriptsDir, "lint.sh"), generateLintScript(config, registry));
  await fs.writeFile(path.join(scriptsDir, "build.sh"), generateBuildScript(config, registry));

  // Make all scripts executable
  for (const script of ["setup.sh", "dev.sh", "test.sh", "lint.sh", "build.sh"]) {
    await fs.chmod(path.join(scriptsDir, script), 0o755);
  }

  // Generate Makefile
  await fs.writeFile(path.join(config.targetDir, "Makefile"), generateMakefile());
}

function generateSetupScript(config: ProjectConfig, registry: Registry): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    'set -euo pipefail',
    '',
    `echo "Setting up ${config.name}..."`,
    '',
    '# Copy env file if not exists',
    'if [ ! -f .env ]; then',
    '  cp .env.example .env 2>/dev/null || true',
    '  echo "Created .env from .env.example"',
    'fi',
    '',
  ];

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      if (entry.lang === "typescript" || entry.lang === "javascript") {
        lines.push('echo "Installing frontend dependencies..."', "cd frontend && npm install && cd ..");
      }
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      if (entry.lang === "python") {
        lines.push(
          '',
          'echo "Installing backend dependencies..."',
          "cd backend",
          "python -m venv venv 2>/dev/null || python3 -m venv venv",
          'source venv/bin/activate',
          "pip install -r requirements.txt",
          "cd .."
        );
      } else if (entry.lang === "go") {
        lines.push('', 'echo "Installing backend dependencies..."', "cd backend && go mod download && cd ..");
      } else {
        lines.push('', 'echo "Installing backend dependencies..."', "cd backend && npm install && cd ..");
      }
    }
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      if (entry.lang === "python") {
        lines.push("python -m venv venv 2>/dev/null || python3 -m venv venv", "source venv/bin/activate", "pip install -r requirements.txt");
      } else if (entry.lang === "go") {
        lines.push("go mod download");
      } else {
        lines.push("npm install");
      }
    }
  }

  lines.push('', 'echo "Setup complete!"');
  return lines.join("\n") + "\n";
}

function generateDevScript(config: ProjectConfig, registry: Registry, useDocker: boolean): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    'set -euo pipefail',
    '',
  ];

  if (useDocker) {
    lines.push(
      'if command -v docker compose &> /dev/null; then',
      '  echo "Starting with Docker Compose..."',
      '  docker compose up --build',
      'else',
      '  echo "Docker not found, starting locally..."',
    );
  }

  if (config.type === "fullstack") {
    // Start both with concurrently or trap
    lines.push(
      '  # Start both services',
      '  trap "kill 0" EXIT',
    );
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      lines.push(`  (cd frontend && ${entry.devCmd}) &`);
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      if (entry.lang === "python") {
        lines.push(`  (cd backend && source venv/bin/activate 2>/dev/null; ${entry.devCmd}) &`);
      } else {
        lines.push(`  (cd backend && ${entry.devCmd}) &`);
      }
    }
    lines.push("  wait");
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      lines.push(`  ${entry.devCmd}`);
    }
  }

  if (useDocker) {
    lines.push("fi");
  }

  return lines.join("\n") + "\n";
}

function generateTestScript(config: ProjectConfig, registry: Registry): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    'set -euo pipefail',
    '',
    'echo "Running tests..."',
    '',
  ];

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      lines.push(`echo "=== Frontend Tests ==="`, `(cd frontend && ${entry.testCmd})`, "");
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      if (entry.lang === "python") {
        lines.push(`echo "=== Backend Tests ==="`, `(cd backend && source venv/bin/activate 2>/dev/null; ${entry.testCmd})`);
      } else {
        lines.push(`echo "=== Backend Tests ==="`, `(cd backend && ${entry.testCmd})`);
      }
    }
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      lines.push(entry.testCmd);
    }
  }

  lines.push('', 'echo "All tests passed!"');
  return lines.join("\n") + "\n";
}

function generateLintScript(config: ProjectConfig, registry: Registry): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    'set -euo pipefail',
    '',
    'echo "Running linters..."',
    '',
  ];

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      lines.push(`echo "=== Frontend Lint ==="`, `(cd frontend && npx eslint . --fix && npx prettier --write .)`, "");
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      if (entry.lintConfig === "ruff") {
        lines.push(`echo "=== Backend Lint ==="`, `(cd backend && source venv/bin/activate 2>/dev/null; ruff check --fix . && ruff format .)`);
      } else if (entry.lintConfig === "golangci-lint") {
        lines.push(`echo "=== Backend Lint ==="`, `(cd backend && golangci-lint run && gofmt -w .)`);
      } else {
        lines.push(`echo "=== Backend Lint ==="`, `(cd backend && npx eslint . --fix && npx prettier --write .)`);
      }
    }
  }

  lines.push('', 'echo "Linting complete!"');
  return lines.join("\n") + "\n";
}

function generateBuildScript(config: ProjectConfig, registry: Registry): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    'set -euo pipefail',
    '',
    'echo "Building..."',
    '',
  ];

  if (config.type === "fullstack") {
    if (config.frontend) {
      const entry = getRegistryEntry(registry, "frontend", config.frontend);
      lines.push(`echo "=== Frontend Build ==="`, `(cd frontend && ${entry.buildCmd})`, "");
    }
    if (config.backend) {
      const entry = getRegistryEntry(registry, "backend", config.backend);
      lines.push(`echo "=== Backend Build ==="`, `(cd backend && ${entry.buildCmd})`);
    }
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    const category = config.frontend ? "frontend" : config.backend ? "backend" : "standalone";
    if (stack) {
      const entry = getRegistryEntry(registry, category, stack);
      lines.push(entry.buildCmd);
    }
  }

  lines.push('', 'echo "Build complete!"');
  return lines.join("\n") + "\n";
}

function generateMakefile(): string {
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
```

**Step 8: Create src/enhancers/ai-context.ts — the AI context file generator**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceAiContext(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  const content = generateAiContextContent(config, registry);

  // CLAUDE.md — Claude Code
  await fs.writeFile(path.join(config.targetDir, "CLAUDE.md"), content.claudeMd);

  // .cursorrules — Cursor
  await fs.writeFile(path.join(config.targetDir, ".cursorrules"), content.cursorRules);

  // .github/copilot.md — GitHub Copilot
  const githubDir = path.join(config.targetDir, ".github");
  await fs.ensureDir(githubDir);
  await fs.writeFile(path.join(githubDir, "copilot.md"), content.copilotMd);

  // AI_CONTEXT.md — Generic
  await fs.writeFile(path.join(config.targetDir, "AI_CONTEXT.md"), content.aiContextMd);
}

function generateAiContextContent(config: ProjectConfig, registry: Registry) {
  const sections = buildSections(config, registry);

  // All files share the same core content, with minor formatting differences
  const claudeMd = `# ${config.name}

${sections.overview}

## Project Structure

${sections.structure}

## Commands

${sections.commands}

## Tech Stack

${sections.techStack}

## Conventions

${sections.conventions}

## Common Tasks

${sections.commonTasks}
`;

  const cursorRules = `You are working on ${config.name}.

${sections.overview}

## Project Structure
${sections.structure}

## Available Commands
${sections.commands}

## Tech Stack
${sections.techStack}

## Coding Conventions
${sections.conventions}

## How To
${sections.commonTasks}
`;

  const copilotMd = claudeMd; // Same format works for Copilot

  const aiContextMd = `# AI Context for ${config.name}

This file provides context for AI coding assistants working on this project.

${sections.overview}

## Structure
${sections.structure}

## Commands
${sections.commands}

## Stack
${sections.techStack}

## Conventions
${sections.conventions}

## Tasks
${sections.commonTasks}
`;

  return { claudeMd, cursorRules, copilotMd, aiContextMd };
}

function buildSections(config: ProjectConfig, registry: Registry) {
  const overview = buildOverview(config);
  const structure = buildStructure(config);
  const commands = buildCommands(config, registry);
  const techStack = buildTechStack(config, registry);
  const conventions = buildConventions(config, registry);
  const commonTasks = buildCommonTasks(config, registry);

  return { overview, structure, commands, techStack, conventions, commonTasks };
}

function buildOverview(config: ProjectConfig): string {
  const parts = [];
  if (config.type === "fullstack") {
    parts.push(`Fullstack monorepo with ${config.frontend || "N/A"} frontend and ${config.backend || "N/A"} backend.`);
  } else {
    const stack = config.frontend || config.backend || config.standalone;
    parts.push(`${config.type} project using ${stack}.`);
  }
  parts.push(`Enhancements: ${config.enhancements.join(", ")}.`);
  return parts.join(" ");
}

function buildStructure(config: ProjectConfig): string {
  if (config.type === "fullstack") {
    return `\`\`\`
${config.name}/
├── frontend/          # Frontend application
├── backend/           # Backend API
├── scripts/           # Uniform shell scripts (setup, dev, test, lint, build)
├── docker-compose.yml # Container orchestration
├── Makefile           # Make targets wrapping scripts/
├── .env.example       # Environment variable template
└── .github/workflows/ # CI pipeline
\`\`\``;
  }
  return `\`\`\`
${config.name}/
├── src/               # Source code
├── tests/             # Test files
├── scripts/           # Uniform shell scripts
├── Makefile           # Make targets
└── .env.example       # Environment template
\`\`\``;
}

function buildCommands(config: ProjectConfig, registry: Registry): string {
  return `| Command | Description |
|---------|-------------|
| \`make setup\` or \`bash scripts/setup.sh\` | Install all dependencies and configure environment |
| \`make dev\` or \`bash scripts/dev.sh\` | Start development server(s) |
| \`make test\` or \`bash scripts/test.sh\` | Run all test suites |
| \`make lint\` or \`bash scripts/lint.sh\` | Run linters and formatters |
| \`make build\` or \`bash scripts/build.sh\` | Production build |`;
}

function buildTechStack(config: ProjectConfig, registry: Registry): string {
  const items: string[] = [];

  if (config.frontend) {
    const entry = getRegistryEntry(registry, "frontend", config.frontend);
    items.push(`- **Frontend:** ${entry.name} (${entry.lang}) — port ${entry.port}`);
  }
  if (config.backend) {
    const entry = getRegistryEntry(registry, "backend", config.backend);
    items.push(`- **Backend:** ${entry.name} (${entry.lang}) — port ${entry.port}`);
  }
  if (config.standalone) {
    const entry = getRegistryEntry(registry, "standalone", config.standalone);
    items.push(`- **Stack:** ${entry.name} (${entry.lang})`);
  }

  if (config.enhancements.includes("docker")) items.push("- **Containerization:** Docker + Docker Compose");
  if (config.enhancements.includes("ci")) items.push("- **CI:** GitHub Actions");
  if (config.enhancements.includes("db")) items.push("- **Database:** PostgreSQL 16");

  return items.join("\n");
}

function buildConventions(config: ProjectConfig, registry: Registry): string {
  const items: string[] = [];

  if (config.frontend) {
    const entry = getRegistryEntry(registry, "frontend", config.frontend);
    if (entry.lintConfig === "eslint-prettier") {
      items.push("- **Frontend:** ESLint + Prettier. Double quotes, semicolons, 2-space indent.");
    }
  }
  if (config.backend) {
    const entry = getRegistryEntry(registry, "backend", config.backend);
    if (entry.lintConfig === "ruff") {
      items.push("- **Backend (Python):** Ruff for linting and formatting. 100 char line length, double quotes.");
    } else if (entry.lintConfig === "golangci-lint") {
      items.push("- **Backend (Go):** golangci-lint + gofmt. Standard Go conventions.");
    }
  }

  items.push("- **Git:** Conventional commits (feat:, fix:, docs:, chore:).");
  items.push("- **Environment:** All config via .env files. Never commit .env, use .env.example as template.");

  return items.join("\n");
}

function buildCommonTasks(config: ProjectConfig, registry: Registry): string {
  const tasks: string[] = [];

  if (config.frontend === "nextjs") {
    tasks.push("- **Add a new page:** Create `frontend/src/app/<route>/page.tsx`");
    tasks.push("- **Add an API route:** Create `frontend/src/app/api/<route>/route.ts`");
  } else if (config.frontend === "react-vite") {
    tasks.push("- **Add a new page:** Create component in `frontend/src/pages/` and add route");
  }

  if (config.backend === "fastapi") {
    tasks.push("- **Add an API endpoint:** Create route in `backend/app/routes/` and import in `main.py`");
    tasks.push("- **Add a model:** Create Pydantic model in `backend/app/models/`");
  } else if (config.backend === "express") {
    tasks.push("- **Add an API endpoint:** Create route in `backend/src/routes/` and mount in `index.ts`");
  } else if (config.backend === "go-chi") {
    tasks.push("- **Add an API endpoint:** Add handler function and mount route in `cmd/server/main.go`");
  }

  tasks.push("- **Add a dependency:** Use the package manager in the relevant sub-directory");
  tasks.push("- **Run a single test:** See test commands in the respective `package.json` or `pyproject.toml`");

  return tasks.join("\n");
}
```

**Step 9: Create src/enhancers/pre-commit.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";

export async function enhancePreCommit(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  // For JS/TS projects, use husky + lint-staged
  // For Python projects, use pre-commit framework
  const hasJs = config.frontend || config.backend === "express" || config.backend === "hono";
  const hasPython = config.backend === "fastapi" || config.backend === "django";

  if (hasPython) {
    const preCommitConfig = `repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
`;
    await fs.writeFile(path.join(config.targetDir, ".pre-commit-config.yaml"), preCommitConfig);
  }

  // Add a simple git hook script regardless
  const hooksDir = path.join(config.targetDir, ".githooks");
  await fs.ensureDir(hooksDir);
  const preCommitHook = `#!/usr/bin/env bash
set -euo pipefail
echo "Running pre-commit checks..."
bash scripts/lint.sh
echo "Pre-commit checks passed!"
`;
  await fs.writeFile(path.join(hooksDir, "pre-commit"), preCommitHook);
  await fs.chmod(path.join(hooksDir, "pre-commit"), 0o755);
}
```

**Step 10: Create src/enhancers/db.ts**

```typescript
import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";

export async function enhanceDb(
  config: ProjectConfig,
  registry: Registry
): Promise<void> {
  // DB enhancement is mostly handled by docker.ts (adds postgres service)
  // Here we add connection helpers to the backend

  if (config.backend === "fastapi") {
    const dbConfig = `"""Database configuration."""
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/${config.name.replace(/-/g, "_")}"
)
`;
    const backendDir = config.type === "fullstack"
      ? path.join(config.targetDir, "backend")
      : config.targetDir;
    await fs.writeFile(path.join(backendDir, "app", "database.py"), dbConfig);
  }
}
```

**Step 11: Commit all enhancers**

```bash
git add src/enhancers/
git commit -m "feat: add all enhancement packs (docker, ci, lint, test, env, ai-context, scripts, pre-commit, db)"
```

---

### Task 7: Wire Everything Together in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Update src/index.ts to the full pipeline**

```typescript
import * as p from "@clack/prompts";
import chalk from "chalk";
import { parseArgs } from "./cli.js";
import { runPrompts } from "./prompts.js";
import { loadRegistry } from "./registry.js";
import { scaffold } from "./scaffold.js";
import { runEnhancers } from "./enhancers/index.js";
import { ProjectConfig } from "./types.js";

async function main() {
  p.intro(chalk.bgCyan(chalk.black(" create-kickstart ")));

  const args = parseArgs(process.argv);

  // Load registry
  const registrySpinner = p.spinner();
  registrySpinner.start("Loading framework registry...");
  const registry = await loadRegistry();
  registrySpinner.stop("Registry loaded");

  // Get config (interactive or from flags)
  let config: ProjectConfig;
  if (args.interactive) {
    config = await runPrompts(args);
  } else {
    if (!args.name) {
      p.cancel("Project name is required in non-interactive mode. Usage: create-kickstart <name> --type ...");
      process.exit(1);
    }
    if (!args.type) {
      p.cancel("--type is required in non-interactive mode (fullstack, frontend, backend, cli-lib)");
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

  // Summary
  p.log.step(chalk.bold("Project configuration:"));
  p.log.info(`  Name:         ${config.name}`);
  p.log.info(`  Type:         ${config.type}`);
  if (config.frontend) p.log.info(`  Frontend:     ${config.frontend}`);
  if (config.backend) p.log.info(`  Backend:      ${config.backend}`);
  if (config.standalone) p.log.info(`  Stack:        ${config.standalone}`);
  p.log.info(`  Enhancements: ${config.enhancements.join(", ")}`);
  p.log.info(`  Directory:    ${config.targetDir}`);

  // Phase 1: Scaffold
  p.log.step(chalk.bold("Phase 1: Scaffolding..."));
  await scaffold(config, registry);

  // Phase 2: Enhance
  p.log.step(chalk.bold("Phase 2: Applying enhancements..."));
  await runEnhancers(config, registry);

  // Phase 3: Generate README
  await generateReadme(config, registry);

  // Initialize git repo in the new project
  const { execa } = await import("execa");
  try {
    await execa("git", ["init"], { cwd: config.targetDir });
    await execa("git", ["add", "."], { cwd: config.targetDir });
    await execa("git", ["commit", "-m", "Initial commit via create-kickstart"], {
      cwd: config.targetDir,
    });
    p.log.success("Initialized git repository");
  } catch {
    // Git not available or init failed — not critical
  }

  // Done!
  p.outro(chalk.green(`${config.name} is ready!`));

  console.log();
  console.log(chalk.bold("  Next steps:"));
  console.log();
  console.log(`  ${chalk.cyan("cd")} ${config.name}`);
  console.log(`  ${chalk.cyan("bash")} scripts/setup.sh`);
  console.log(`  ${chalk.cyan("bash")} scripts/dev.sh`);
  console.log();
  console.log(chalk.dim("  Or with Make:"));
  console.log(`  ${chalk.cyan("make")} setup && ${chalk.cyan("make")} dev`);
  console.log();

  if (config.enhancements.includes("docker")) {
    console.log(chalk.dim("  Or with Docker:"));
    console.log(`  ${chalk.cyan("docker compose")} up --build`);
    console.log();
  }
}

async function generateReadme(config: ProjectConfig, registry: Registry): Promise<void> {
  const { default: fs } = await import("fs-extra");
  const path = await import("path");

  const readme = `# ${config.name}

> Scaffolded with [create-kickstart](https://github.com/swapnil/create-kickstart)

## Quick Start

\`\`\`bash
# Install dependencies
bash scripts/setup.sh

# Start development
bash scripts/dev.sh

# Or use Make
make setup && make dev
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`make setup\` | Install dependencies and configure environment |
| \`make dev\` | Start development server(s) |
| \`make test\` | Run test suites |
| \`make lint\` | Run linters and formatters |
| \`make build\` | Production build |

${config.enhancements.includes("docker") ? `## Docker

\`\`\`bash
docker compose up --build
\`\`\`
` : ""}
## Project Structure

See \`CLAUDE.md\` or \`AI_CONTEXT.md\` for detailed project documentation.
`;

  await fs.writeFile(path.join(config.targetDir, "README.md"), readme);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Build and test end-to-end (non-interactive)**

```bash
npm run build
node dist/index.js test-app --type backend --backend fastapi --with docker,ci,lint,env,ai-context --no-interactive
```

Expected: A `test-app/` directory with backend structure, Docker, CI, scripts, AI context files.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire full pipeline — scaffold + enhance + readme + git init"
```

---

### Task 8: curl | bash Setup Script

**Files:**
- Create: `setup.sh` (at project root)

**Step 1: Create setup.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# create-kickstart bootstrapper
# Usage: curl -fsSL https://raw.githubusercontent.com/swapnil/create-kickstart/main/setup.sh | bash -s -- [options]
#
# Options:
#   --name <name>         Project name (required)
#   --type <type>         fullstack, frontend, backend, cli-lib
#   --frontend <stack>    nextjs, react-vite, vue, svelte, angular
#   --backend <stack>     fastapi, express, hono, django, go-chi, spring-boot
#   --with <enhancements> Comma-separated: docker,ci,lint,test,env,ai-context
#   --help                Show this help

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${BLUE}[kickstart]${NC} $1"; }
ok()    { echo -e "${GREEN}[kickstart]${NC} $1"; }
err()   { echo -e "${RED}[kickstart]${NC} $1" >&2; }

# Parse arguments
NAME=""
TYPE=""
FRONTEND=""
BACKEND=""
WITH="docker,ci,lint,test,env,ai-context"
STANDALONE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --name)       NAME="$2"; shift 2 ;;
    --type)       TYPE="$2"; shift 2 ;;
    --frontend)   FRONTEND="$2"; shift 2 ;;
    --backend)    BACKEND="$2"; shift 2 ;;
    --standalone) STANDALONE="$2"; shift 2 ;;
    --with)       WITH="$2"; shift 2 ;;
    --help)
      echo "Usage: curl -fsSL <url>/setup.sh | bash -s -- --name my-app --type fullstack --frontend nextjs --backend fastapi"
      echo ""
      echo "Options:"
      echo "  --name <name>         Project name (required)"
      echo "  --type <type>         fullstack, frontend, backend, cli-lib"
      echo "  --frontend <stack>    nextjs, react-vite, vue, svelte, angular"
      echo "  --backend <stack>     fastapi, express, hono, django, go-chi, spring-boot"
      echo "  --with <enhancements> Comma-separated (default: docker,ci,lint,test,env,ai-context)"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$NAME" ]; then
  err "Project name is required. Use --name <name>"
  exit 1
fi

if [ -z "$TYPE" ]; then
  err "Project type is required. Use --type <type> (fullstack, frontend, backend, cli-lib)"
  exit 1
fi

# Check for Node.js
if command -v node &> /dev/null && command -v npx &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    log "Found Node.js v$(node -v | cut -d'v' -f2), using npx..."

    CMD="npx create-kickstart@latest $NAME --type $TYPE --with $WITH --no-interactive"
    [ -n "$FRONTEND" ] && CMD="$CMD --frontend $FRONTEND"
    [ -n "$BACKEND" ] && CMD="$CMD --backend $BACKEND"
    [ -n "$STANDALONE" ] && CMD="$CMD --standalone $STANDALONE"

    eval "$CMD"
    exit $?
  fi
fi

# Fallback: no Node.js >= 18
err "Node.js >= 18 is required. Install from https://nodejs.org/"
err "Or use: npx create-kickstart@latest $NAME --type $TYPE"
exit 1
```

**Step 2: Make executable**

```bash
chmod +x setup.sh
```

**Step 3: Commit**

```bash
git add setup.sh
git commit -m "feat: add curl|bash bootstrapper setup.sh"
```

---

### Task 9: gitignore and README for the CLI repo itself

**Files:**
- Modify: `.gitignore`
- Create: `README.md`

**Step 1: Update .gitignore**

```
node_modules/
dist/
*.tgz
.env
.env.local
test-app/
tmp/
```

**Step 2: Create README.md for the repo**

```markdown
# create-kickstart

Scaffold production-ready projects in seconds. Composable multi-stack templates with AI context files, Docker, CI, and uniform scripts.

## Quick Start

```bash
# Interactive mode
npx create-kickstart

# Non-interactive (for AI agents and scripts)
npx create-kickstart my-app \
  --type fullstack \
  --frontend nextjs \
  --backend fastapi \
  --with docker,ci,lint,test,env,ai-context \
  --no-interactive

# Zero-deps via curl
curl -fsSL https://raw.githubusercontent.com/swapnil/create-kickstart/main/setup.sh | bash -s -- \
  --name my-app --type fullstack --frontend nextjs --backend fastapi
```

## Features

- **Composable stacks** — Mix any frontend with any backend
- **Official starters** — Uses create-next-app, create-vite, etc. under the hood
- **Enhancement packs** — Docker, GitHub Actions CI, linting, testing, .env, pre-commit
- **AI-friendly** — Generates CLAUDE.md, .cursorrules, copilot.md, AI_CONTEXT.md
- **Uniform scripts** — `make setup && make dev` works for every stack
- **Three modes** — Interactive, CLI flags, curl|bash

## Supported Stacks

### Frontend
- Next.js (TypeScript)
- React + Vite (TypeScript)
- Vue 3 + Vite
- SvelteKit
- Angular

### Backend
- FastAPI (Python)
- Express (TypeScript)
- Hono (TypeScript)
- Django (Python)
- Go (Chi)
- Spring Boot (Java)

### Standalone
- Python CLI (Click)
- Python Library
- Node.js CLI

## Enhancements

| Flag | What it adds |
|------|-------------|
| `docker` | Dockerfile per service, docker-compose.yml |
| `ci` | GitHub Actions workflow (lint + test + build) |
| `lint` | ESLint/Prettier, Ruff, or golangci-lint |
| `test` | Test runner config + example tests |
| `env` | .env.example + .env management |
| `ai-context` | CLAUDE.md, .cursorrules, copilot.md |
| `pre-commit` | Git hooks for linting |
| `db` | PostgreSQL via Docker Compose |

## Contributing

```bash
git clone https://github.com/swapnil/create-kickstart
cd create-kickstart
npm install
npm run dev   # watch mode
npm run build && node dist/index.js  # test locally
```

## License

MIT
```

**Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: add README and update gitignore"
```

---

### Task 10: Include templates in npm build + final build test

**Files:**
- Modify: `tsup.config.ts`
- Modify: `package.json`

**Step 1: Update package.json to include templates and registry in npm package**

Add to package.json `"files"` field:
```json
"files": ["dist", "src/templates", "registry.json", "setup.sh"]
```

**Step 2: Update scaffold.ts template path resolution**

The templates need to resolve correctly whether running from source or from installed npm package. Update the `TEMPLATES_DIR` in `src/scaffold.ts`:

```typescript
// Try multiple locations for templates
function getTemplatesDir(): string {
  const candidates = [
    path.join(__dirname, "..", "src", "templates"),     // dev (from dist/)
    path.join(__dirname, "..", "templates"),             // alternate
    path.join(__dirname, "templates"),                   // bundled
  ];
  for (const c of candidates) {
    if (fs.pathExistsSync(c)) return c;
  }
  return candidates[0]; // fallback
}

const TEMPLATES_DIR = getTemplatesDir();
```

**Step 3: Full end-to-end test**

```bash
npm run build

# Test 1: Backend only
node dist/index.js test-backend --type backend --backend fastapi --with docker,ci,lint,env,ai-context --no-interactive
ls -la test-backend/
cat test-backend/CLAUDE.md
cat test-backend/scripts/dev.sh
rm -rf test-backend

# Test 2: Fullstack (frontend scaffold will need network access for create-next-app)
node dist/index.js test-fullstack --type fullstack --frontend react-vite --backend express --with docker,ci,lint,test,env,ai-context --no-interactive
ls -la test-fullstack/
cat test-fullstack/docker-compose.yml
cat test-fullstack/Makefile
rm -rf test-fullstack
```

**Step 4: Commit**

```bash
git add package.json tsup.config.ts src/scaffold.ts
git commit -m "feat: finalize build — include templates and registry in npm package"
```

---

### Task 11: Create GitHub repo and push

**Step 1: Create the GitHub repository**

```bash
gh repo create create-kickstart --public --description "Scaffold production-ready projects with composable multi-stack templates, AI context files, and uniform scripts" --source . --remote origin --push
```

**Step 2: Verify**

```bash
gh repo view --web
```

---

## Execution Summary

| Task | Description | Estimated Time |
|------|-------------|---------------|
| 1 | Project scaffolding & build pipeline | 5 min |
| 2 | CLI argument parsing | 5 min |
| 3 | Interactive prompts | 5 min |
| 4 | Registry system | 5 min |
| 5 | Scaffold orchestrator + backend templates | 10 min |
| 6 | All enhancement packs (8 modules) | 20 min |
| 7 | Wire full pipeline in index.ts | 5 min |
| 8 | curl\|bash setup script | 5 min |
| 9 | Repo README + gitignore | 3 min |
| 10 | Build finalization + e2e test | 5 min |
| 11 | GitHub repo creation | 2 min |
| **Total** | | **~70 min** |
