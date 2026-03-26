import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { scaffold } from "../src/scaffold.js";
import { loadRegistry } from "../src/registry.js";
import { enhanceEnv } from "../src/enhancers/env.js";
import { enhanceCache } from "../src/enhancers/cache.js";
import { enhanceQueue } from "../src/enhancers/queue.js";
import { enhanceWebSocket } from "../src/enhancers/websocket.js";
import { enhanceStorage } from "../src/enhancers/storage.js";
import type { ProjectConfig, Registry } from "../src/types.js";

let registry: Registry;

beforeAll(async () => {
  registry = await loadRegistry();
});

describe("Axum scaffold", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-axum");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("scaffolds an Axum backend with Cargo.toml and main.rs", async () => {
    const config: ProjectConfig = {
      name: "test-axum",
      type: "backend",
      backend: "axum",
      enhancements: [],
      targetDir,
    };

    await scaffold(config, registry);

    // Verify Cargo.toml exists and has correct content
    const cargoPath = path.join(targetDir, "Cargo.toml");
    expect(await fs.pathExists(cargoPath)).toBe(true);
    const cargoToml = await fs.readFile(cargoPath, "utf-8");
    expect(cargoToml).toContain('name = "test-axum"');
    expect(cargoToml).toContain("axum");
    expect(cargoToml).toContain("tokio");

    // Verify src/main.rs exists with health endpoint
    const mainRsPath = path.join(targetDir, "src", "main.rs");
    expect(await fs.pathExists(mainRsPath)).toBe(true);
    const mainRs = await fs.readFile(mainRsPath, "utf-8");
    expect(mainRs).toContain("health");
    expect(mainRs).toContain("test-axum");
  });
});

describe("cache enhancer", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-cache");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("generates Redis cache client for FastAPI backend", async () => {
    const config: ProjectConfig = {
      name: "test-cache",
      type: "backend",
      backend: "fastapi",
      enhancements: ["cache", "env"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceEnv(config, registry);
    await enhanceCache(config, registry);

    // Verify Redis client file exists
    const cachePath = path.join(targetDir, "app", "cache.py");
    expect(await fs.pathExists(cachePath)).toBe(true);

    // Verify content
    const content = await fs.readFile(cachePath, "utf-8");
    expect(content).toContain("redis");
    expect(content).toContain("cache_get");
    expect(content).toContain("cache_set");
  });
});

describe("queue enhancer", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-queue");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("generates publisher and consumer files for FastAPI backend", async () => {
    const config: ProjectConfig = {
      name: "test-queue",
      type: "backend",
      backend: "fastapi",
      enhancements: ["queue", "env"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceEnv(config, registry);
    await enhanceQueue(config, registry);

    // Verify publisher and consumer files exist
    const publisherPath = path.join(targetDir, "app", "queue", "publisher.py");
    const consumerPath = path.join(targetDir, "app", "queue", "consumer.py");
    expect(await fs.pathExists(publisherPath)).toBe(true);
    expect(await fs.pathExists(consumerPath)).toBe(true);

    // Verify content
    const publisher = await fs.readFile(publisherPath, "utf-8");
    expect(publisher).toContain("publish");
    expect(publisher).toContain("pika");

    const consumer = await fs.readFile(consumerPath, "utf-8");
    expect(consumer).toContain("consume");
  });
});

describe("websocket enhancer", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-ws");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("generates WebSocket handler for FastAPI backend", async () => {
    const config: ProjectConfig = {
      name: "test-ws",
      type: "backend",
      backend: "fastapi",
      enhancements: ["websocket", "env"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceEnv(config, registry);
    await enhanceWebSocket(config, registry);

    // Verify ws handler file exists
    const wsPath = path.join(targetDir, "app", "ws.py");
    expect(await fs.pathExists(wsPath)).toBe(true);

    // Verify content
    const content = await fs.readFile(wsPath, "utf-8");
    expect(content).toContain("WebSocket");
    expect(content).toContain("websocket_endpoint");
  });
});

describe("storage enhancer", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-storage");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("generates upload module and create-bucket script for FastAPI backend", async () => {
    const config: ProjectConfig = {
      name: "test-storage",
      type: "backend",
      backend: "fastapi",
      enhancements: ["storage", "env"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceEnv(config, registry);
    await enhanceStorage(config, registry);

    // Verify upload module exists
    const uploadPath = path.join(targetDir, "app", "upload.py");
    expect(await fs.pathExists(uploadPath)).toBe(true);

    // Verify upload content
    const content = await fs.readFile(uploadPath, "utf-8");
    expect(content).toContain("presigned");
    expect(content).toContain("S3_BUCKET");

    // Verify create-bucket.sh exists
    const bucketScriptPath = path.join(targetDir, "scripts", "create-bucket.sh");
    expect(await fs.pathExists(bucketScriptPath)).toBe(true);

    // Verify script is executable
    const stat = await fs.stat(bucketScriptPath);
    expect(stat.mode & 0o100).toBeTruthy();

    // Verify script content
    const script = await fs.readFile(bucketScriptPath, "utf-8");
    expect(script).toContain("mc");
    expect(script).toContain("S3_BUCKET");
  });
});
