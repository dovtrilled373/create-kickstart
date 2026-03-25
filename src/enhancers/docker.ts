import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Dockerfile generators
// ---------------------------------------------------------------------------

function nodejsDockerfile(port: number): string {
  return `# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE ${port}
CMD ["node", "dist/index.js"]
`;
}

function pythonDockerfile(port: number): string {
  return `FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${port}
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`;
}

function goDockerfile(port: number): string {
  return `# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/server ./cmd/server

# Stage 2: Production
FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /bin/server ./server
EXPOSE ${port}
CMD ["./server"]
`;
}

function javaDockerfile(port: number): string {
  return `FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE ${port}
CMD ["java", "-jar", "app.jar"]
`;
}

function dockerignore(): string {
  return `node_modules
dist
.env
.git
.gitignore
*.md
__pycache__
*.pyc
.venv
venv
bin/
.idea
.vscode
`;
}

function getDockerfileForLang(lang: string, port: number): string {
  switch (lang) {
    case "python":
      return pythonDockerfile(port);
    case "go":
      return goDockerfile(port);
    case "java":
      return javaDockerfile(port);
    default:
      return nodejsDockerfile(port);
  }
}

// ---------------------------------------------------------------------------
// Docker Compose generator (string-based YAML)
// ---------------------------------------------------------------------------

function composeService(
  name: string,
  build: string,
  port: number,
  envFile?: string,
  dependsOn?: string[],
): string {
  let svc = `  ${name}:\n`;
  svc += `    build: ${build}\n`;
  svc += `    ports:\n      - "${port}:${port}"\n`;
  if (envFile) {
    svc += `    env_file:\n      - ${envFile}\n`;
  }
  if (dependsOn && dependsOn.length > 0) {
    svc += `    depends_on:\n`;
    for (const dep of dependsOn) {
      svc += `      - ${dep}\n`;
    }
  }
  svc += `    restart: unless-stopped\n`;
  return svc;
}

function postgresService(): string {
  return `  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDocker(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;
  const hasDb = config.enhancements.includes("db");

  if (type === "fullstack") {
    // Frontend Dockerfile
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      const feDir = path.join(targetDir, "frontend");
      await fs.writeFile(path.join(feDir, "Dockerfile"), getDockerfileForLang(feEntry.lang, feEntry.port));
      await fs.writeFile(path.join(feDir, ".dockerignore"), dockerignore());
    }

    // Backend Dockerfile
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      const beDir = path.join(targetDir, "backend");
      await fs.writeFile(path.join(beDir, "Dockerfile"), getDockerfileForLang(beEntry.lang, beEntry.port));
      await fs.writeFile(path.join(beDir, ".dockerignore"), dockerignore());
    }

    // docker-compose.yml
    const feEntry = config.frontend ? getRegistryEntry(registry, "frontend", config.frontend) : null;
    const beEntry = config.backend ? getRegistryEntry(registry, "backend", config.backend) : null;

    let compose = `version: "3.8"\n\nservices:\n`;

    if (feEntry) {
      compose += composeService("frontend", "./frontend", feEntry.port, ".env");
    }
    if (beEntry) {
      const deps = hasDb ? ["postgres"] : undefined;
      compose += composeService("backend", "./backend", beEntry.port, ".env", deps);
    }
    if (hasDb) {
      compose += postgresService();
    }

    if (hasDb) {
      compose += `\nvolumes:\n  pgdata:\n`;
    }

    await fs.writeFile(path.join(targetDir, "docker-compose.yml"), compose);
  } else {
    // Single-stack project
    const { stackKey, category } = resolveStack(config);
    const entry = getRegistryEntry(registry, category, stackKey);

    await fs.writeFile(path.join(targetDir, "Dockerfile"), getDockerfileForLang(entry.lang, entry.port));
    await fs.writeFile(path.join(targetDir, ".dockerignore"), dockerignore());

    let compose = `version: "3.8"\n\nservices:\n`;
    const deps = hasDb ? ["postgres"] : undefined;
    compose += composeService("app", ".", entry.port, ".env", deps);
    if (hasDb) {
      compose += postgresService();
      compose += `\nvolumes:\n  pgdata:\n`;
    }

    await fs.writeFile(path.join(targetDir, "docker-compose.yml"), compose);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStack(config: ProjectConfig): { stackKey: string; category: string } {
  if (config.frontend) return { stackKey: config.frontend, category: "frontend" };
  if (config.backend) return { stackKey: config.backend, category: "backend" };
  if (config.standalone) return { stackKey: config.standalone, category: "standalone" };
  throw new Error("No stack configured");
}
