import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Backend CORS generators
// ---------------------------------------------------------------------------

function fastapiCors(frontendPort: number): string {
  return `from fastapi.middleware.cors import CORSMiddleware

CORS_ORIGINS = [
    "http://localhost:${frontendPort}",
    "http://127.0.0.1:${frontendPort}",
]


def add_cors(app):
    """Add CORS middleware allowing the frontend dev server."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
`;
}

function expressCors(frontendPort: number): string {
  return `import { CorsOptions } from "cors";

const corsOptions: CorsOptions = {
  origin: [
    "http://localhost:${frontendPort}",
    "http://127.0.0.1:${frontendPort}",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

export default corsOptions;
`;
}

function goChiCors(frontendPort: number): string {
  return `package internal

import (
\t"net/http"

\t"github.com/go-chi/cors"
)

// CorsMiddleware returns a configured CORS handler allowing the frontend dev server.
func CorsMiddleware() func(http.Handler) http.Handler {
\treturn cors.Handler(cors.Options{
\t\tAllowedOrigins:   []string{"http://localhost:${frontendPort}", "http://127.0.0.1:${frontendPort}"},
\t\tAllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
\t\tAllowedHeaders:   []string{"Content-Type", "Authorization"},
\t\tAllowCredentials: true,
\t\tMaxAge:           300,
\t})
}
`;
}

// ---------------------------------------------------------------------------
// Frontend proxy / Next.js config
// ---------------------------------------------------------------------------

function nextConfig(backendPort: number): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:${backendPort}/api/:path*",
      },
    ];
  },
};

export default nextConfig;
`;
}

// ---------------------------------------------------------------------------
// API client helpers
// ---------------------------------------------------------------------------

function apiClientNext(): string {
  return `const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`);
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async del(path: string): Promise<void> {
    const res = await fetch(\`\${API_BASE}\${path}\`, { method: "DELETE" });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  },
};
`;
}

function apiClientVite(): string {
  return `const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`);
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${path}\`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
    return res.json();
  },
  async del(path: string): Promise<void> {
    const res = await fetch(\`\${API_BASE}\${path}\`, { method: "DELETE" });
    if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  },
};
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceApiWiring(
  config: ProjectConfig,
  registry: Registry,
): Promise<void> {
  if (config.type !== "fullstack") return;

  const feStack = config.frontend;
  const beStack = config.backend;
  if (!feStack || !beStack) return;

  const feEntry = getRegistryEntry(registry, "frontend", feStack);
  const beEntry = getRegistryEntry(registry, "backend", beStack);
  const feDir = path.join(config.targetDir, "frontend");
  const beDir = path.join(config.targetDir, "backend");

  // --- A) Backend CORS ---
  switch (beStack) {
    case "fastapi": {
      await fs.ensureDir(path.join(beDir, "app"));
      await fs.writeFile(
        path.join(beDir, "app", "middleware.py"),
        fastapiCors(feEntry.port),
      );
      break;
    }
    case "express": {
      await fs.ensureDir(path.join(beDir, "src"));
      await fs.writeFile(
        path.join(beDir, "src", "cors.ts"),
        expressCors(feEntry.port),
      );
      break;
    }
    case "go-chi": {
      await fs.ensureDir(path.join(beDir, "internal"));
      await fs.writeFile(
        path.join(beDir, "internal", "cors.go"),
        goChiCors(feEntry.port),
      );
      break;
    }
  }

  // --- B) Frontend proxy ---
  if (feStack === "nextjs") {
    await fs.writeFile(
      path.join(feDir, "next.config.mjs"),
      nextConfig(beEntry.port),
    );
  }

  // --- C) API client helper ---
  const libDir = path.join(feDir, "src", "lib");
  await fs.ensureDir(libDir);

  if (feStack === "nextjs") {
    await fs.writeFile(path.join(libDir, "api.ts"), apiClientNext());
  } else {
    // Vite-based stacks: react-vite, vue, svelte
    await fs.writeFile(path.join(libDir, "api.ts"), apiClientVite());
  }
}
