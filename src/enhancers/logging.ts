import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Python logging (FastAPI / Django)
// ---------------------------------------------------------------------------

function pythonLoggingConfig(): string {
  return `"""Structured logging configuration using structlog."""
import structlog
import logging
import uuid

def setup_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if __import__('os').getenv('LOG_FORMAT') != 'json'
            else structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
    )

def get_logger(name: str = __name__):
    return structlog.get_logger(name)
`;
}

function pythonRequestIdMiddleware(): string {
  return `"""Request ID middleware for FastAPI."""
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import structlog

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
`;
}

// ---------------------------------------------------------------------------
// TypeScript logging (Express / Hono)
// ---------------------------------------------------------------------------

function tsLogger(): string {
  return `import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
});

export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.requestId = requestId;
    const start = Date.now();
    res.on("finish", () => {
      logger.info({
        requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Date.now() - start,
      });
    });
    res.setHeader("X-Request-ID", requestId);
    next();
  };
}
`;
}

// ---------------------------------------------------------------------------
// Go logging (Chi)
// ---------------------------------------------------------------------------

function goLogger(): string {
  return `package logger

import (
\t"os"
\t"github.com/rs/zerolog"
\t"github.com/rs/zerolog/log"
)

func Setup() {
\tif os.Getenv("LOG_FORMAT") != "json" {
\t\tlog.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
\t}
\tzerolog.SetGlobalLevel(zerolog.InfoLevel)
}

func Get() zerolog.Logger {
\treturn log.Logger
}
`;
}

// ---------------------------------------------------------------------------
// Frontend error boundaries
// ---------------------------------------------------------------------------

function reactErrorBoundary(): string {
  return `import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", { error: error.message, stack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: "red" }}>{this.state.error?.message}</pre>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
`;
}

function vueErrorBoundary(): string {
  return `<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const hasError = ref(false);
const errorMessage = ref("");

onErrorCaptured((error: Error) => {
  hasError.value = true;
  errorMessage.value = error.message;
  console.error("[ErrorBoundary]", { error: error.message });
  return false;
});

function retry() {
  hasError.value = false;
  errorMessage.value = "";
}
</script>

<template>
  <div v-if="hasError" style="padding: 2rem; text-align: center">
    <h2>Something went wrong</h2>
    <pre style="color: red">{{ errorMessage }}</pre>
    <button @click="retry">Try again</button>
  </div>
  <slot v-else />
</template>
`;
}

function svelteErrorComponent(): string {
  return `<script lang="ts">
  export let error: Error | undefined = undefined;
  export let onRetry: (() => void) | undefined = undefined;
</script>

{#if error}
  <div style="padding: 2rem; text-align: center;">
    <h2>Something went wrong</h2>
    <pre style="color: red;">{error.message}</pre>
    {#if onRetry}
      <button on:click={onRetry}>Try again</button>
    {/if}
  </div>
{/if}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceLogging(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  // Backend logging
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const beDir = type === "fullstack" ? path.join(targetDir, "backend") : targetDir;

    if (beEntry.lang === "python") {
      await fs.ensureDir(path.join(beDir, "app", "middleware"));
      await fs.writeFile(path.join(beDir, "app", "logging_config.py"), pythonLoggingConfig());
      await fs.writeFile(
        path.join(beDir, "app", "middleware", "request_id.py"),
        pythonRequestIdMiddleware(),
      );

      // Add structlog to requirements.txt if it exists
      const reqFile = path.join(beDir, "requirements.txt");
      if (await fs.pathExists(reqFile)) {
        const contents = await fs.readFile(reqFile, "utf-8");
        if (!contents.includes("structlog")) {
          await fs.appendFile(reqFile, "\nstructlog\n");
        }
      }
    } else if (beEntry.lang === "typescript") {
      await fs.ensureDir(path.join(beDir, "src"));
      await fs.writeFile(path.join(beDir, "src", "logger.ts"), tsLogger());
    } else if (beEntry.lang === "go") {
      await fs.ensureDir(path.join(beDir, "internal", "logger"));
      await fs.writeFile(path.join(beDir, "internal", "logger", "logger.go"), goLogger());
    }
  }

  // Frontend error boundary
  if (config.frontend) {
    const feDir = type === "fullstack" ? path.join(targetDir, "frontend") : targetDir;
    const componentsDir = path.join(feDir, "src", "components");
    await fs.ensureDir(componentsDir);

    if (config.frontend === "nextjs" || config.frontend === "react-vite") {
      await fs.writeFile(path.join(componentsDir, "ErrorBoundary.tsx"), reactErrorBoundary());
    } else if (config.frontend === "vue") {
      await fs.writeFile(path.join(componentsDir, "ErrorBoundary.vue"), vueErrorBoundary());
    } else if (config.frontend === "svelte") {
      await fs.writeFile(path.join(componentsDir, "ErrorBoundary.svelte"), svelteErrorComponent());
    } else if (config.frontend === "angular") {
      // Angular has built-in ErrorHandler; skip custom boundary
    }
  }
}
