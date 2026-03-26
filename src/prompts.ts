import * as p from "@clack/prompts";
import { ProjectConfig, ProjectType, FrontendStack, BackendStack, MobileStack, StandaloneStack, Enhancement, DatabaseChoice, AnalyticsProvider, ApiProtocol } from "./types.js";

export const BACKEND_STACK_OPTIONS = [
  { value: "fastapi", label: "FastAPI", hint: "Python" },
  { value: "express", label: "Express", hint: "TypeScript" },
  { value: "hono", label: "Hono", hint: "TypeScript, lightweight" },
  { value: "django", label: "Django", hint: "Python" },
  { value: "go-chi", label: "Go (Chi)", hint: "Go" },
  { value: "spring-boot", label: "Spring Boot", hint: "Java" },
  { value: "axum", label: "Axum", hint: "Rust" },
  { value: "aspnet", label: "ASP.NET", hint: "C#" },
  { value: "phoenix", label: "Phoenix", hint: "Elixir" },
] as const;

const MOBILE_STACK_OPTIONS = [
  { value: "react-native", label: "React Native", hint: "TypeScript" },
  { value: "flutter", label: "Flutter", hint: "Dart" },
  { value: "swift", label: "Swift (iOS)", hint: "SwiftUI" },
  { value: "kotlin", label: "Kotlin (Android)", hint: "Jetpack Compose" },
] as const;

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
        { value: "mobile", label: "Mobile app" },
        { value: "cli-lib", label: "CLI tool / Library" },
      ],
    })) as ProjectType);

  if (p.isCancel(type)) process.exit(0);

  let frontend: FrontendStack | undefined = partial.frontend;
  let backend: BackendStack | undefined = partial.backend;
  let mobile: MobileStack | undefined = partial.mobile;
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
      options: [...BACKEND_STACK_OPTIONS],
    })) as BackendStack;
    if (p.isCancel(backend)) process.exit(0);
  }

  // Mobile selection — for "mobile" type or optionally for "fullstack"
  if (type === "mobile" && !mobile) {
    mobile = (await p.select({
      message: "Pick your mobile stack:",
      options: [...MOBILE_STACK_OPTIONS],
    })) as MobileStack;
    if (p.isCancel(mobile)) process.exit(0);
  }

  if (type === "fullstack" && !mobile) {
    const wantMobile = await p.confirm({
      message: "Add a mobile app to the monorepo?",
      initialValue: false,
    });
    if (p.isCancel(wantMobile)) process.exit(0);
    if (wantMobile) {
      mobile = (await p.select({
        message: "Pick your mobile stack:",
        options: [
          { value: "react-native", label: "React Native", hint: "TypeScript" },
          { value: "flutter", label: "Flutter", hint: "Dart" },
          { value: "swift", label: "Swift (iOS)", hint: "SwiftUI" },
          { value: "kotlin", label: "Kotlin (Android)", hint: "Jetpack Compose" },
        ],
      })) as MobileStack;
      if (p.isCancel(mobile)) process.exit(0);
    }
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
    partial.enhancements && partial.enhancements.length > 0
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
            { value: "db", label: "Database", hint: "Postgres, MySQL, SQLite, or MongoDB" },
            { value: "api-wiring", label: "API wiring", hint: "CORS + proxy + fetch client (fullstack)" },
            { value: "sample-crud", label: "Sample CRUD", hint: "Working /items API + frontend list" },
            { value: "doctor", label: "Doctor script", hint: "Validate dev environment prereqs" },
            { value: "logging", label: "Structured logging", hint: "pino/structlog + request IDs" },
            { value: "deploy", label: "Deploy configs", hint: "Vercel, Railway, Fly.io, Render" },
            { value: "deps-auto", label: "Dependency automation", hint: "Dependabot config" },
            { value: "api-types", label: "Shared API types", hint: "OpenAPI → TypeScript (fullstack)" },
            { value: "auth", label: "Authentication scaffold", hint: "JWT + login/register endpoints" },
            { value: "analytics", label: "Analytics / Marketing SDK", hint: "PostHog, CleverTap, MoEngage, Mixpanel, Segment" },
            { value: "observability", label: "Observability stack", hint: "OpenTelemetry + Grafana + Prometheus + Tempo + Loki" },
            { value: "api-protocol", label: "API protocol layers", hint: "GraphQL (client), gRPC (internal)" },
            { value: "cache", label: "Redis cache", hint: "caching + sessions" },
            { value: "queue", label: "Message queue", hint: "RabbitMQ or Kafka" },
            { value: "websocket", label: "WebSocket", hint: "real-time communication" },
            { value: "storage", label: "S3 storage", hint: "file uploads with MinIO" },
          ],
          initialValues: ["docker", "ci", "lint", "test", "env", "ai-context", "api-wiring", "doctor"],
        })) as Enhancement[]);

  if (p.isCancel(enhancements)) process.exit(0);

  // --- Sub-selectors for enhancements that need choices ---

  // Database
  let database: DatabaseChoice | undefined = partial.database;
  if (enhancements.includes("db") && !database) {
    database = (await p.select({
      message: "Pick your database:",
      options: [
        { value: "postgres", label: "PostgreSQL", hint: "Recommended for production" },
        { value: "mysql", label: "MySQL" },
        { value: "sqlite", label: "SQLite", hint: "Zero config, great for prototypes" },
        { value: "mongodb", label: "MongoDB", hint: "Document store" },
      ],
    })) as DatabaseChoice;
    if (p.isCancel(database)) process.exit(0);
  }

  // Analytics provider
  let analyticsProvider: AnalyticsProvider | undefined = partial.analyticsProvider;
  if (enhancements.includes("analytics") && !analyticsProvider) {
    analyticsProvider = (await p.select({
      message: "Pick your analytics provider:",
      options: [
        { value: "posthog", label: "PostHog", hint: "Open source, self-hostable" },
        { value: "segment", label: "Segment", hint: "Universal data pipeline" },
        { value: "mixpanel", label: "Mixpanel", hint: "Product analytics" },
        { value: "clevertap", label: "CleverTap", hint: "Engagement + analytics" },
        { value: "moengage", label: "MoEngage", hint: "Marketing automation" },
      ],
    })) as AnalyticsProvider;
    if (p.isCancel(analyticsProvider)) process.exit(0);
  }

  // API protocol
  let apiProtocol: ApiProtocol | undefined = partial.apiProtocol;
  if (enhancements.includes("api-protocol") && !apiProtocol) {
    apiProtocol = (await p.select({
      message: "Pick your API protocol layer:",
      options: [
        { value: "graphql", label: "GraphQL only", hint: "Client-facing API" },
        { value: "grpc", label: "gRPC only", hint: "Internal service-to-service" },
        { value: "graphql+grpc", label: "Both GraphQL + gRPC", hint: "GraphQL for clients, gRPC for internal" },
      ],
    })) as ApiProtocol;
    if (p.isCancel(apiProtocol)) process.exit(0);
  }

  const targetDir = `${process.cwd()}/${name}`;

  return { name, type, frontend, backend, mobile, standalone, enhancements, database, analyticsProvider, apiProtocol, targetDir };
}
