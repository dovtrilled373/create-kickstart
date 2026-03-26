# create-kickstart

Scaffold production-ready fullstack, backend, mobile, and CLI projects in seconds. One command. Any stack. AI-friendly.

```bash
npx create-kickstart
```

## Why?

Starting a new project shouldn't take hours. Every time you start a POC or greenfield project, you repeat the same setup: Docker, CI/CD, linting, testing, env management, database configs, deployment. **create-kickstart does all of it in one command.**

## What makes it different?

| Feature | create-kickstart | create-next-app | cookiecutter | yeoman |
|---------|-----------------|-----------------|-------------|--------|
| Multi-stack (React + FastAPI) | Yes | No | No | No |
| Add services to existing project | Yes | No | No | No |
| Switch deploy providers | Yes | No | No | No |
| AI context files (CLAUDE.md, .cursorrules) | Yes | No | No | No |
| Observability (Grafana + OTel) | Yes | No | No | No |
| 8 deploy providers + Terraform | Yes | No | No | No |
| Analytics SDK (PostHog, Segment) | Yes | No | No | No |
| GraphQL + gRPC scaffold | Yes | No | No | No |
| Mobile (React Native, Flutter) | Yes | No | No | No |

## Quick Start

```bash
# Interactive — walks you through every choice
npx create-kickstart

# One-liner — for AI agents and scripts
npx create-kickstart my-app \
  --type fullstack \
  --frontend react-vite \
  --backend fastapi \
  --with docker,ci,lint,test,env,db,ai-context \
  --database postgres \
  --no-interactive
```

## Supported Stacks

### Frontend
Next.js | React + Vite | Vue 3 | SvelteKit | Angular

### Backend
FastAPI (Python) | Express (TypeScript) | Hono | Django | Go Chi | Spring Boot (Java)

### Mobile
React Native | Flutter | Swift (iOS) | Kotlin (Android)

### Database
PostgreSQL | MySQL | SQLite | MongoDB

## Enhancements

Pick what you need — mix and match:

| Enhancement | What it does |
|------------|-------------|
| `docker` | Dockerfile + docker-compose for all services |
| `ci` | GitHub Actions CI workflow |
| `lint` | ESLint/Prettier, Ruff, golangci-lint |
| `test` | Test runner config + example tests |
| `env` | .env management with .env.example |
| `db` | Database configs (Postgres, MySQL, SQLite, MongoDB) |
| `ai-context` | CLAUDE.md, .cursorrules, copilot.md, AI_CONTEXT.md |
| `auth` | JWT authentication (login/register) |
| `sample-crud` | Working /items CRUD API + frontend component |
| `api-wiring` | CORS + proxy + typed API client (fullstack) |
| `doctor` | Dev environment prerequisite checker |
| `logging` | Structured logging (pino, structlog, zerolog) |
| `observability` | OpenTelemetry + Grafana + Prometheus + Tempo + Loki |
| `analytics` | PostHog, CleverTap, MoEngage, Mixpanel, Segment |
| `api-protocol` | GraphQL (client-facing) + gRPC (internal) |
| `deploy` | Deploy configs for 8 platforms |
| `deps-auto` | Dependabot automation |
| `pre-commit` | Pre-commit hooks |

## Multi-Service Monorepo

Add backend services in any language to your existing project:

```bash
cd my-app
npx create-kickstart add payment-svc --backend express --with db,test
npx create-kickstart add notifications --backend go-chi --with test
```

Result:
```
my-app/
  frontend/
  backend/
    api/              # Primary (FastAPI)
    payment-svc/      # Express (TypeScript)
    notifications/    # Go (Chi)
  docker-compose.yml  # All services wired
```

## Progressive Deployment

Start easy, graduate when ready:

```bash
# POC — deploy to Railway in 1 minute
npx create-kickstart deploy --provider railway

# Production — switch to AWS ECS with Terraform
npx create-kickstart deploy --provider aws-ecs
# Generates: VPC, ECS cluster, ECR, ALB, GitHub Actions CI/CD

# Scale — switch to Kubernetes
npx create-kickstart deploy --provider kubernetes
# Generates: Helm chart + K8s manifests
```

| Tier | Providers |
|------|-----------|
| PaaS | Railway, Render, Fly.io, Vercel |
| Cloud-native | AWS ECS (Fargate), GCP Cloud Run, Azure Container Apps |
| Kubernetes | Helm charts + K8s manifests |

Cloud-native providers include full Terraform modules (VPC, load balancer, container registry, auto-scaling).

## AI-Friendly

Every generated project includes AI context files tailored for each tool:

- **CLAUDE.md** — Architecture diagram, commands, "how to add" recipes for Claude Code
- **.cursorrules** — Code style rules, project structure rules for Cursor
- **.github/copilot.md** — File locations, test commands for GitHub Copilot
- **AI_CONTEXT.md** — Overview and quick reference for ChatGPT and others

The CLI itself is AI-agent friendly — `--no-interactive` mode accepts all options as flags, so any AI coding assistant can scaffold projects programmatically.

## Contributing

```bash
git clone https://github.com/sswapnil2/create-kickstart
cd create-kickstart
npm install
npm run build
node dist/index.js my-app --type backend --backend fastapi --with docker,env --no-interactive
```

See [CLAUDE.md](CLAUDE.md) for architecture docs and "how to add" guides.

## License

MIT
