# create-kickstart

CLI tool that scaffolds production-ready fullstack, backend, frontend, and mobile projects with composable stacks and enhancements.

## Architecture

```
src/
  index.ts          # Entry point — CLI pipeline: parse → prompt → scaffold → enhance → git init
  cli.ts            # Commander arg parsing + subcommand routing (add, deploy)
  prompts.ts        # Interactive prompts via @clack/prompts
  types.ts          # All type definitions (stacks, enhancements, configs)
  registry.ts       # Loads framework registry (remote → local fallback)
  scaffold.ts       # Phase 1: scaffolds project via CLI tools or templates
  add-service.ts    # "add" subcommand: adds services to existing monorepo
  deploy.ts         # "deploy" subcommand: generates deploy configs per provider
  deploy-terraform.ts # Terraform modules for cloud-native providers
  enhancers/
    index.ts        # Enhancer orchestrator (ordered execution)
    utils.ts        # Shared: resolveProjectDirs, appendEnvVars, autoRegisterRoute
    docker.ts       # Dockerfile + docker-compose generation
    ci.ts           # GitHub Actions CI workflow
    lint.ts         # ESLint/Prettier/Ruff configs
    test.ts         # Test runner setup
    env.ts          # .env management
    db.ts           # Database configs (Postgres/MySQL/SQLite/MongoDB)
    auth.ts         # JWT auth scaffold
    sample-crud.ts  # Working /items CRUD endpoints + frontend component
    ai-context.ts   # CLAUDE.md, .cursorrules, copilot.md, AI_CONTEXT.md generation
    analytics.ts    # PostHog/CleverTap/MoEngage/Mixpanel/Segment SDKs
    observability.ts # OpenTelemetry + Grafana/Prometheus/Tempo/Loki
    api-protocol.ts # GraphQL (Strawberry/Apollo) + gRPC stubs
    api-wiring.ts   # CORS + proxy + API client for fullstack
    scripts.ts      # Uniform shell scripts (setup/dev/test/lint/build)
    doctor.ts       # Dev environment prerequisite checker
    deploy.ts       # Deploy config enhancer (different from deploy subcommand)
    deps-auto.ts    # Dependabot config
    api-types.ts    # OpenAPI → TypeScript type generation
    logging.ts      # Structured logging (pino/structlog/zerolog)
    pre-commit.ts   # Pre-commit hook setup
  templates/        # Template-based starters (copied + var-replaced)
    fastapi/        # Python FastAPI starter
    express/        # TypeScript Express starter
    django/         # Python Django starter
    go-chi/         # Go Chi starter
    spring-boot/    # Java Spring Boot starter
    swift/          # SwiftUI iOS starter
    kotlin/         # Jetpack Compose Android starter
registry.json       # Framework registry: stack → scaffold command, port, lang, commands
```

## Key Concepts

**Three-phase pipeline:** parse CLI args → scaffold via official CLIs or templates → apply enhancements in dependency order.

**Enhancer ordering:** Defined in `enhancers/index.ts` ENHANCER_ORDER. env runs first (creates .env), db next (appends DB vars), docker after (reads DB choice for compose services), then everything else.

**Fullstack monorepo layout:**
```
project/
  frontend/           # Scaffolded by create-vite, create-next-app, etc.
  backend/
    api/              # Primary backend (PRIMARY_BACKEND_NAME constant)
    payment-svc/      # Added via "add" subcommand
  docker-compose.yml  # All services wired together
```

**resolveProjectDirs(config)** in `utils.ts` is the single source of truth for beDir/feDir/mobileDir. All enhancers use it.

## Commands

```bash
npm run build          # tsup → dist/index.js (ESM bundle)
npm test               # vitest (33 tests)
npm run dev            # tsup --watch

# Test locally
node dist/index.js my-app --type fullstack --frontend react-vite --backend fastapi --with docker,env --no-interactive

# Test subcommands
cd /tmp/my-app && node /path/to/dist/index.js add payment-svc --backend express --no-interactive
cd /tmp/my-app && node /path/to/dist/index.js deploy --provider aws-ecs --no-interactive
```

## Adding a New Stack

1. Add entry to `registry.json` under the right category (frontend/backend/mobile/standalone)
2. If `scaffoldType: "template"`, create `src/templates/<stack-key>/` with starter files
3. If `scaffoldType: "cli"`, just set `scaffoldCmd` — the official CLI does the work
4. Update `types.ts` to add the stack to the union type
5. Update `prompts.ts` to add it to the select options

## Adding a New Enhancer

1. Create `src/enhancers/<name>.ts` with `export async function enhance<Name>(config, registry)`
2. Use `resolveProjectDirs(config)` for directory paths
3. Use `appendEnvVars(targetDir, guard, block)` for .env additions
4. Add to `Enhancement` union in `types.ts`
5. Import + add to `ENHANCER_MAP` and `ENHANCER_ORDER` in `enhancers/index.ts`
6. Add to prompt options in `prompts.ts`

## Adding a New Deploy Provider

1. Add to `DeployProvider` union in `types.ts`
2. Add metadata to `PROVIDERS` map in `deploy.ts`
3. Add config + workflow functions in `deploy.ts`
4. Add case to the switch in `runDeploy` and `deployScript`
5. For cloud-native: add Terraform module in `deploy-terraform.ts`
