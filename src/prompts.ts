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
            { value: "db", label: "Database (Postgres)", hint: "via Docker" },
            { value: "api-wiring", label: "API wiring", hint: "CORS + proxy + fetch client (fullstack)" },
            { value: "sample-crud", label: "Sample CRUD", hint: "Working /items API + frontend list" },
            { value: "doctor", label: "Doctor script", hint: "Validate dev environment prereqs" },
            { value: "logging", label: "Structured logging", hint: "pino/structlog + request IDs" },
            { value: "deploy", label: "Deploy configs", hint: "Vercel, Railway, Fly.io, Render" },
            { value: "deps-auto", label: "Dependency automation", hint: "Dependabot config" },
            { value: "api-types", label: "Shared API types", hint: "OpenAPI → TypeScript (fullstack)" },
            { value: "auth", label: "Authentication scaffold", hint: "JWT + login/register endpoints" },
          ],
          initialValues: ["docker", "ci", "lint", "test", "env", "ai-context", "api-wiring", "doctor"],
        })) as Enhancement[]);

  if (p.isCancel(enhancements)) process.exit(0);

  const targetDir = `${process.cwd()}/${name}`;

  return { name, type, frontend, backend, standalone, enhancements, targetDir };
}
