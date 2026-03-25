# create-kickstart — Design Document

**Date:** 2026-03-25
**Status:** Approved

## Problem Statement

Starting a new project or POC is painful. Every time you scaffold a project you repeat the same work: Docker setup, CI pipelines, linting config, env management, testing scaffolding, gitignore, and project structure. Worse, AI coding tools (Claude, Cursor, ChatGPT, Copilot) have no context about new projects — they can't run setup commands or understand conventions without manual onboarding.

### Pain points this solves

1. **Repetitive boilerplate** — Docker, CI, linting, env, testing config is copy-pasted across projects
2. **Framework fragmentation** — Every framework has different setup commands, file structures, and conventions
3. **AI tool onboarding friction** — New projects lack context files; AI tools can't help effectively from day zero
4. **Multi-language fullstack** — Frontend (TS) + Backend (Python/Go) projects need manual composition
5. **Non-uniform scripts** — `npm run dev` vs `uvicorn` vs `go run` — no consistency across stacks
6. **No quick curl-and-go** — AI agents and scripts can't easily scaffold projects non-interactively

## Architecture: "Orchestrator, Not Store"

`create-kickstart` does NOT store templates. It orchestrates official framework starters and layers opinionated "enhancement packs" on top.

```
┌──────────────────────────────────────────────────────┐
│                  npx create-kickstart                 │
│                                                       │
│  Phase 1: Prompt    Phase 2: Scaffold   Phase 3: Enhance
│  ┌──────────┐       ┌──────────────┐    ┌───────────┐│
│  │ Prompter │──────▶│ Orchestrator │───▶│ Enhancer  ││
│  │ (select  │       │ (calls the   │    │ (layers   ││
│  │  stacks, │       │ official CLI  │    │ Docker,CI ││
│  │  options)│       │ or starter)  │    │ lint,env) ││
│  └──────────┘       └──────────────┘    └───────────┘│
│                           │                           │
│                           ▼                           │
│                ┌─────────────────────┐                │
│                │  registry.json      │                │
│                │  (fetched from GH   │                │
│                │   at runtime)       │                │
│                └─────────────────────┘                │
└──────────────────────────────────────────────────────┘
```

### Registry-driven

`registry.json` is fetched from GitHub at runtime. Adding a new framework = PR to one JSON file, no CLI release needed.

## Three Execution Modes

### Mode 1: Interactive (humans)

```bash
$ npx create-kickstart
> What are you building?  [Fullstack]
> Frontend:               [Next.js]
> Backend:                [FastAPI]
> Enhancements:           [Docker, CI, Lint, Test, Env, AI Context]
> Project name:           [my-app]
```

### Mode 2: CLI flags (AI agents / scripts)

```bash
npx create-kickstart my-app \
  --type fullstack \
  --frontend nextjs \
  --backend fastapi \
  --with docker,ci,lint,test,env,ai-context \
  --no-interactive
```

### Mode 3: curl | bash (zero-deps, AI-native)

```bash
curl -fsSL https://raw.githubusercontent.com/user/create-kickstart/main/setup.sh | bash -s -- \
  --type fullstack \
  --frontend nextjs \
  --backend fastapi \
  --name my-app \
  --with docker,ci,lint,test,env,ai-context
```

## Composable Multi-Stack Projects

The CLI supports four project types:

| Type | What it scaffolds |
|------|-------------------|
| `fullstack` | frontend/ + backend/ monorepo |
| `frontend` | frontend-only project |
| `backend` | backend/API-only project |
| `cli-lib` | CLI tool or library |

### Fullstack composition flow

```
Phase 1: Scaffold          Phase 2: Compose           Phase 3: Enhance
─────────────────          ──────────────────          ─────────────────

create-next-app ──┐        ┌─ Move into frontend/     ┌─ Inject Dockerfiles
                  ├──▶     ├─ Move into backend/  ──▶  ├─ Generate docker-compose
fastapi starter ──┘        ├─ Merge .gitignore         ├─ Generate CI workflow
                           └─ Merge .env               ├─ Generate scripts/
                                                       ├─ Generate AI context files
                                                       └─ Generate Makefile
```

## Supported Stacks (Initial)

### Frontend

| Stack | Official Starter | Port |
|-------|-----------------|------|
| Next.js | `create-next-app@latest` | 3000 |
| React + Vite | `create vite -- --template react-ts` | 5173 |
| Vue 3 + Vite | `create vue@latest` | 5173 |
| Svelte + SvelteKit | `sv create` | 5173 |
| Angular | `@angular/cli new` | 4200 |

### Backend

| Stack | Scaffold Method | Port | Language |
|-------|----------------|------|----------|
| FastAPI | pip + template files | 8000 | Python |
| Express | express-generator | 3001 | TypeScript |
| Hono | create-hono | 3001 | TypeScript |
| Django | django-admin startproject | 8000 | Python |
| Go (Chi) | go mod init + template files | 8080 | Go |
| Spring Boot | spring initializr | 8080 | Java |

### Standalone

| Stack | Scaffold Method | Language |
|-------|----------------|----------|
| Python CLI (Click) | Template files | Python |
| Python Library | Template files | Python |
| Node.js CLI | Template files | TypeScript |

## Enhancement Packs

Each enhancement is an independent module that injects files/config into the scaffolded project.

| Enhancement | What it generates |
|-------------|-------------------|
| `docker` | Dockerfile per service, docker-compose.yml, .dockerignore |
| `ci` | .github/workflows/ci.yml (lint + test + build) |
| `lint` | ESLint/Prettier (JS/TS), Ruff (Python), golangci-lint (Go) — per stack |
| `test` | Test runner config + example tests that actually pass |
| `env` | .env.example, .env.local (gitignored), env loading pattern in code |
| `ai-context` | CLAUDE.md, .cursorrules, .github/copilot.md, AI_CONTEXT.md |
| `pre-commit` | .pre-commit-config.yaml or husky + lint-staged |
| `db` | Postgres service in docker-compose, connection config, migration setup |

## AI Context Files

Every scaffolded project generates AI-friendly context files:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Claude Code context — structure, commands, conventions |
| `.cursorrules` | Cursor AI context |
| `.github/copilot.md` | GitHub Copilot instructions |
| `AI_CONTEXT.md` | Generic AI context (ChatGPT, other tools) |

### Content (auto-generated per stack):

- Project structure and entry points
- Available commands (install, run, test, lint, build, deploy)
- Tech stack with versions
- Code conventions and naming patterns
- Architecture overview and data flow
- Common tasks ("to add an API route, do X")

## Uniform Shell Scripts

Every project gets `scripts/` that normalize commands across all stacks:

| Script | Purpose |
|--------|---------|
| `setup.sh` | Install all deps, copy .env.example, run migrations |
| `dev.sh` | Start dev server(s), optionally via Docker Compose |
| `test.sh` | Run all test suites with coverage |
| `lint.sh` | Lint + format + type-check all code |
| `build.sh` | Production build |

Plus a `Makefile` wrapping them: `make setup`, `make dev`, `make test`, `make lint`, `make build`.

An AI agent can always run `bash scripts/setup.sh && bash scripts/dev.sh` regardless of stack.

## Generated Project Structure (Fullstack Example)

```
my-app/
├── frontend/                    # Scaffolded by official starter
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.json          # ← lint enhancer
│   ├── Dockerfile              # ← docker enhancer
│   └── ...
│
├── backend/                     # Scaffolded by official starter
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   └── models/
│   ├── tests/
│   │   └── test_main.py        # ← test enhancer
│   ├── pyproject.toml
│   ├── Dockerfile              # ← docker enhancer
│   └── .python-version
│
├── scripts/
│   ├── setup.sh
│   ├── dev.sh
│   ├── test.sh
│   ├── lint.sh
│   └── build.sh
│
├── docker-compose.yml           # frontend:3000 + backend:8000 + db:5432
├── .env.example
├── .gitignore
├── Makefile
├── CLAUDE.md
├── .cursorrules
├── .github/
│   ├── copilot.md
│   └── workflows/ci.yml
├── AI_CONTEXT.md
└── README.md
```

## registry.json Schema

```jsonc
{
  "version": "1.0.0",
  "frontend": {
    "nextjs": {
      "name": "Next.js",
      "scaffoldCmd": "npx create-next-app@latest {{name}} --ts --app --use-npm --no-import-alias",
      "port": 3000,
      "lang": "typescript",
      "devCmd": "npm run dev",
      "buildCmd": "npm run build",
      "testCmd": "npm test",
      "lintConfig": "eslint-prettier"
    }
  },
  "backend": {
    "fastapi": {
      "name": "FastAPI",
      "scaffoldCmd": "pip install fastapi uvicorn && mkdir -p {{name}}",
      "scaffoldType": "template",
      "port": 8000,
      "lang": "python",
      "devCmd": "uvicorn app.main:app --reload --port 8000",
      "buildCmd": "echo 'No build step'",
      "testCmd": "pytest",
      "lintConfig": "ruff"
    }
  },
  "standalone": { }
}
```

## CLI Technology

- **Language:** TypeScript
- **Package name:** `create-kickstart`
- **Distribution:** npm (`npx create-kickstart`)
- **Prompting:** `@clack/prompts` (beautiful terminal UI)
- **File ops:** `fs-extra`
- **Template vars:** Simple string replacement (`{{PROJECT_NAME}}`, `{{PORT}}`)
- **Shell execution:** `execa`
- **Bundling:** `tsup`

## Distribution

1. `npx create-kickstart` — primary, interactive
2. `npx create-kickstart <name> --flags` — non-interactive for AI/scripts
3. `curl | bash` via `setup.sh` — zero-dep bootstrapper
4. GitHub repo clone — for contributors and customizers

## Future Expansion (Not in v1)

- Custom template repos (our own, community)
- Plugin system for custom enhancements
- `create-kickstart update` — re-run enhancements on existing project
- Monorepo workspace support (Turborepo, Nx)
- Database migration scaffold (Prisma, Alembic, GORM)
- Auth scaffold (NextAuth, JWT patterns)
