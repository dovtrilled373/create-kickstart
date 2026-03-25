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
  | "db"
  | "api-wiring"
  | "sample-crud"
  | "doctor"
  | "logging"
  | "deploy"
  | "deps-auto"
  | "api-types";

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
  scaffoldCmd?: string;
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
