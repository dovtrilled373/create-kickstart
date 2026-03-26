import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// OpenTelemetry SDK init per language
// ---------------------------------------------------------------------------

function otelPythonInit(): string {
  return `"""
OpenTelemetry instrumentation — Python

Install:
  pip install opentelemetry-api opentelemetry-sdk \\
    opentelemetry-instrumentation-fastapi \\
    opentelemetry-exporter-otlp-proto-grpc

Docs: https://opentelemetry.io/docs/languages/python/
"""

import os
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "app")
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")


def setup_telemetry():
    """Call once at app startup."""
    resource = Resource.create({"service.name": SERVICE_NAME})

    # Traces
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=OTEL_ENDPOINT, insecure=True))
    )
    trace.set_tracer_provider(tracer_provider)

    # Metrics
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=OTEL_ENDPOINT, insecure=True),
        export_interval_millis=15000,
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    return tracer_provider


# Convenience
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# Example custom metric
request_counter = meter.create_counter(
    "app.requests.total",
    description="Total number of requests",
)
`;
}

function otelNodeInit(): string {
  return `/**
 * OpenTelemetry instrumentation — Node.js
 *
 * Install:
 *   npm i @opentelemetry/api @opentelemetry/sdk-node \\
 *     @opentelemetry/auto-instrumentations-node \\
 *     @opentelemetry/exporter-trace-otlp-grpc \\
 *     @opentelemetry/exporter-metrics-otlp-grpc
 *
 * IMPORTANT: Import this file FIRST in your entry point:
 *   import "./lib/telemetry.js"; // must be first import
 *
 * Docs: https://opentelemetry.io/docs/languages/js/
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "app",
  traceExporter: new OTLPTraceExporter({ url: OTEL_ENDPOINT }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: OTEL_ENDPOINT }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Graceful shutdown
process.on("SIGTERM", () => sdk.shutdown());
process.on("SIGINT", () => sdk.shutdown());

export default sdk;
`;
}

function otelGoInit(): string {
  return `package telemetry

// OpenTelemetry instrumentation — Go
//
// Install:
//   go get go.opentelemetry.io/otel
//   go get go.opentelemetry.io/otel/sdk
//   go get go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
//   go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
//
// Docs: https://opentelemetry.io/docs/languages/go/

import (
\t"context"
\t"os"

\t"go.opentelemetry.io/otel"
\t"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
\t"go.opentelemetry.io/otel/sdk/resource"
\t"go.opentelemetry.io/otel/sdk/trace"
\tsemconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

func getEnvOrDefault(key, fallback string) string {
\tif v := os.Getenv(key); v != "" {
\t\treturn v
\t}
\treturn fallback
}

// Setup initializes OpenTelemetry and returns a shutdown function.
func Setup(ctx context.Context) (func(context.Context) error, error) {
\tserviceName := getEnvOrDefault("OTEL_SERVICE_NAME", "app")
\tendpoint := getEnvOrDefault("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")

\texporter, err := otlptracegrpc.New(ctx,
\t\totlptracegrpc.WithEndpoint(endpoint),
\t\totlptracegrpc.WithInsecure(),
\t)
\tif err != nil {
\t\treturn nil, err
\t}

\tres := resource.NewWithAttributes(
\t\tsemconv.SchemaURL,
\t\tsemconv.ServiceNameKey.String(serviceName),
\t)

\ttp := trace.NewTracerProvider(
\t\ttrace.WithBatcher(exporter),
\t\ttrace.WithResource(res),
\t)
\totel.SetTracerProvider(tp)

\treturn tp.Shutdown, nil
}
`;
}

// ---------------------------------------------------------------------------
// Grafana stack Docker Compose services
// ---------------------------------------------------------------------------

function grafanaComposeServices(): string {
  return `
  # ── Observability stack ──────────────────────────────
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./observability/otel-collector-config.yml:/etc/otelcol-contrib/config.yaml
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3100:3000"
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - grafanadata:/var/lib/grafana
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  tempo:
    image: grafana/tempo:latest
    ports:
      - "3200:3200"
    command: ["-config.file=/etc/tempo/tempo.yml"]
    volumes:
      - ./observability/tempo.yml:/etc/tempo/tempo.yml
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    ports:
      - "3101:3100"
    restart: unless-stopped
`;
}

// ---------------------------------------------------------------------------
// Config files for the observability stack
// ---------------------------------------------------------------------------

function otelCollectorConfig(): string {
  return `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024

exporters:
  otlphttp/tempo:
    endpoint: http://tempo:3200
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
`;
}

function prometheusConfig(): string {
  return `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "otel-collector"
    static_configs:
      - targets: ["otel-collector:8888"]

# Enable remote write receiver for OTel collector
# (prometheus needs --web.enable-remote-write-receiver flag)
`;
}

function tempoConfig(): string {
  return `server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
        http:

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
`;
}

function grafanaDatasources(): string {
  return `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
      serviceMap:
        datasourceUid: prometheus

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    uid: loki
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceObservability(config: ProjectConfig, registry: Registry): Promise<void> {
  const isFullstack = config.type === "fullstack";

  // 1. Write OTel SDK init per backend
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const beDir = isFullstack ? path.join(config.targetDir, "backend") : config.targetDir;

    if (beEntry.lang === "python") {
      const libDir = path.join(beDir, "app", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "telemetry.py"), otelPythonInit());
    } else if (beEntry.lang === "typescript") {
      const libDir = path.join(beDir, "src", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "telemetry.ts"), otelNodeInit());
    } else if (beEntry.lang === "go") {
      const telDir = path.join(beDir, "internal", "telemetry");
      await fs.ensureDir(telDir);
      await fs.writeFile(path.join(telDir, "telemetry.go"), otelGoInit());
    }
  }

  // 2. Write observability config files
  const obsDir = path.join(config.targetDir, "observability");
  await fs.ensureDir(obsDir);
  await fs.ensureDir(path.join(obsDir, "grafana", "provisioning", "datasources"));

  await fs.writeFile(path.join(obsDir, "otel-collector-config.yml"), otelCollectorConfig());
  await fs.writeFile(path.join(obsDir, "prometheus.yml"), prometheusConfig());
  await fs.writeFile(path.join(obsDir, "tempo.yml"), tempoConfig());
  await fs.writeFile(
    path.join(obsDir, "grafana", "provisioning", "datasources", "datasources.yml"),
    grafanaDatasources(),
  );

  // 3. Append services to docker-compose.yml if it exists
  const composePath = path.join(config.targetDir, "docker-compose.yml");
  if (await fs.pathExists(composePath)) {
    let compose = await fs.readFile(composePath, "utf-8");
    if (!compose.includes("otel-collector")) {
      // Insert before volumes section or at end of services
      if (compose.includes("\nvolumes:")) {
        compose = compose.replace("\nvolumes:", grafanaComposeServices() + "\nvolumes:");
        // Add grafanadata volume
        compose = compose.replace(
          /^(volumes:\n)/m,
          "$1  grafanadata:\n",
        );
      } else {
        compose += grafanaComposeServices();
        compose += "\nvolumes:\n  grafanadata:\n";
      }
      await fs.writeFile(composePath, compose);
    }
  } else {
    // Create a standalone docker-compose for observability
    let compose = `version: "3.8"\n\nservices:\n`;
    compose += grafanaComposeServices();
    compose += "\nvolumes:\n  grafanadata:\n";
    await fs.writeFile(composePath, compose);
  }

  // 4. Add env vars
  const envExample = path.join(config.targetDir, ".env.example");
  if (await fs.pathExists(envExample)) {
    const contents = await fs.readFile(envExample, "utf-8");
    if (!contents.includes("OTEL_SERVICE_NAME")) {
      await fs.appendFile(envExample, `\n# Observability (OpenTelemetry)
OTEL_SERVICE_NAME=${config.name}
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
`);
    }
  }
}
