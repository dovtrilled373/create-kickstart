import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Vercel
// ---------------------------------------------------------------------------

function vercelConfig(frontend: string): string {
  let framework: string;
  let outputDirectory: string;

  switch (frontend) {
    case "nextjs":
      framework = "nextjs";
      outputDirectory = ".next";
      break;
    case "angular":
      framework = "angular";
      outputDirectory = "dist";
      break;
    case "svelte":
      framework = "sveltekit";
      outputDirectory = ".svelte-kit";
      break;
    default:
      // react-vite, vue — all use vite with dist/
      framework = "vite";
      outputDirectory = "dist";
      break;
  }

  return JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework,
      buildCommand: "npm run build",
      outputDirectory,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Railway
// ---------------------------------------------------------------------------

function railwayConfig(devCmd: string): string {
  return JSON.stringify(
    {
      $schema: "https://railway.app/railway.schema.json",
      build: { builder: "DOCKERFILE" },
      deploy: {
        startCommand: devCmd,
        healthcheckPath: "/health",
        restartPolicyType: "ON_FAILURE",
      },
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Fly.io
// ---------------------------------------------------------------------------

function flyToml(projectName: string, port: number): string {
  return `app = "${projectName}"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = ${port}
  force_https = true

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderYamlFullstack(
  projectName: string,
  backendPort: number,
  frontendStack: string,
): string {
  return `services:
  - type: web
    name: ${projectName}-backend
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    envVars:
      - key: PORT
        value: "${backendPort}"

  - type: web
    name: ${projectName}-frontend
    runtime: static
    buildCommand: cd frontend && npm run build
    staticPublishPath: ./frontend/${frontendStack === "nextjs" ? ".next" : "dist"}
`;
}

function renderYamlBackendOnly(projectName: string, port: number): string {
  return `services:
  - type: web
    name: ${projectName}-backend
    runtime: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: PORT
        value: "${port}"
`;
}

function renderYamlFrontendOnly(projectName: string, frontendStack: string): string {
  return `services:
  - type: web
    name: ${projectName}-frontend
    runtime: static
    buildCommand: npm run build
    staticPublishPath: ./${frontendStack === "nextjs" ? ".next" : "dist"}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDeploy(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type, name: projectName } = config;

  if (type === "fullstack") {
    const feDir = path.join(targetDir, "frontend");
    const beDir = path.join(targetDir, "backend");

    // Vercel — in frontend dir
    if (config.frontend) {
      await fs.writeFile(path.join(feDir, "vercel.json"), vercelConfig(config.frontend));
    }

    // Railway — in backend dir
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      await fs.writeFile(path.join(beDir, "railway.json"), railwayConfig(beEntry.devCmd));
    }

    // Fly.io — in backend dir
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      await fs.writeFile(path.join(beDir, "fly.toml"), flyToml(projectName, beEntry.port));
    }

    // Render — at project root
    if (config.backend && config.frontend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      await fs.writeFile(
        path.join(targetDir, "render.yaml"),
        renderYamlFullstack(projectName, beEntry.port, config.frontend),
      );
    }
  } else if (type === "frontend" && config.frontend) {
    // Frontend-only
    await fs.writeFile(path.join(targetDir, "vercel.json"), vercelConfig(config.frontend));
    await fs.writeFile(
      path.join(targetDir, "render.yaml"),
      renderYamlFrontendOnly(projectName, config.frontend),
    );
  } else if (type === "backend" && config.backend) {
    // Backend-only
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    await fs.writeFile(path.join(targetDir, "railway.json"), railwayConfig(beEntry.devCmd));
    await fs.writeFile(path.join(targetDir, "fly.toml"), flyToml(projectName, beEntry.port));
    await fs.writeFile(
      path.join(targetDir, "render.yaml"),
      renderYamlBackendOnly(projectName, beEntry.port),
    );
  }
}
