export type ProjectType = "fullstack" | "frontend" | "backend" | "mobile" | "cli-lib";

export type FrontendStack = "nextjs" | "react-vite" | "vue" | "svelte" | "angular";
export type BackendStack = "fastapi" | "express" | "hono" | "django" | "go-chi" | "spring-boot";
export type MobileStack = "react-native" | "flutter" | "swift" | "kotlin";
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
  | "api-types"
  | "auth"
  | "analytics"
  | "observability"
  | "api-protocol";

export type DatabaseChoice = "postgres" | "mysql" | "sqlite" | "mongodb";
export type AnalyticsProvider = "posthog" | "clevertap" | "moengage" | "mixpanel" | "segment";
export type ApiProtocol = "graphql" | "grpc" | "graphql+grpc";

export interface ProjectConfig {
  name: string;
  type: ProjectType;
  frontend?: FrontendStack;
  backend?: BackendStack;
  mobile?: MobileStack;
  standalone?: StandaloneStack;
  enhancements: Enhancement[];
  database?: DatabaseChoice;
  analyticsProvider?: AnalyticsProvider;
  apiProtocol?: ApiProtocol;
  targetDir: string;
}

// Used by the "add" subcommand to add services to existing projects
export interface AddServiceConfig {
  serviceName: string;
  backend: BackendStack;
  enhancements: Enhancement[];
  database?: DatabaseChoice;
  targetDir: string; // existing project root
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
  mobile: Record<string, RegistryEntry>;
  standalone: Record<string, RegistryEntry>;
}
