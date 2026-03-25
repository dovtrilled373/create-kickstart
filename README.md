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
curl -fsSL https://raw.githubusercontent.com/user/create-kickstart/main/setup.sh | bash -s -- \
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
git clone https://github.com/user/create-kickstart
cd create-kickstart
npm install
npm run dev   # watch mode
npm run build && node dist/index.js  # test locally
```

## License

MIT
