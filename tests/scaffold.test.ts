import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { scaffold } from "../src/scaffold.js";
import { loadRegistry } from "../src/registry.js";
import { enhanceScripts } from "../src/enhancers/scripts.js";
import { enhanceDocker } from "../src/enhancers/docker.js";
import { enhanceAiContext } from "../src/enhancers/ai-context.js";
import { enhanceDoctor } from "../src/enhancers/doctor.js";
import type { ProjectConfig, Registry } from "../src/types.js";

let registry: Registry;

beforeAll(async () => {
  registry = await loadRegistry();
});

describe("scaffold integration", () => {
  let tmpDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kickstart-test-"));
    targetDir = path.join(tmpDir, "test-project");
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("scaffolds a FastAPI backend with template files", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: [],
      targetDir,
    };

    await scaffold(config, registry);

    // Verify expected files exist
    expect(await fs.pathExists(path.join(targetDir, "app", "main.py"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "requirements.txt"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "app", "__init__.py"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "tests", "test_main.py"))).toBe(true);

    // Verify template vars are replaced
    const mainPy = await fs.readFile(path.join(targetDir, "app", "main.py"), "utf-8");
    expect(mainPy).toContain("test-project");
  });

  it("scaffolds an Express backend with template files", async () => {
    const config: ProjectConfig = {
      name: "test-express",
      type: "backend",
      backend: "express",
      enhancements: [],
      targetDir,
    };

    await scaffold(config, registry);

    expect(await fs.pathExists(path.join(targetDir, "src", "index.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "package.json"))).toBe(true);
  });

  it("generates scripts for backend-only project", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: [],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceScripts(config, registry);

    // Verify script files exist
    const scriptsDir = path.join(targetDir, "scripts");
    expect(await fs.pathExists(path.join(scriptsDir, "setup.sh"))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, "dev.sh"))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, "test.sh"))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, "lint.sh"))).toBe(true);
    expect(await fs.pathExists(path.join(scriptsDir, "build.sh"))).toBe(true);

    // Verify Makefile exists
    expect(await fs.pathExists(path.join(targetDir, "Makefile"))).toBe(true);

    // Verify scripts are executable (mode includes 0o755)
    const stat = await fs.stat(path.join(scriptsDir, "setup.sh"));
    // Check that owner execute bit is set
    expect(stat.mode & 0o100).toBeTruthy();
  });

  it("generates scripts with correct content for FastAPI", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: [],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceScripts(config, registry);

    const devSh = await fs.readFile(path.join(targetDir, "scripts", "dev.sh"), "utf-8");
    expect(devSh).toContain("uvicorn");

    const testSh = await fs.readFile(path.join(targetDir, "scripts", "test.sh"), "utf-8");
    expect(testSh).toContain("pytest");

    const setupSh = await fs.readFile(path.join(targetDir, "scripts", "setup.sh"), "utf-8");
    expect(setupSh).toContain("pip install");
  });

  it("generates docker files when docker enhancement is selected", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: ["docker"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceDocker(config, registry);

    expect(await fs.pathExists(path.join(targetDir, "Dockerfile"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "docker-compose.yml"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, ".dockerignore"))).toBe(true);

    // Verify Dockerfile contains python base image
    const dockerfile = await fs.readFile(path.join(targetDir, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("python");

    // Verify docker-compose.yml contains service
    const compose = await fs.readFile(path.join(targetDir, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("services:");
    expect(compose).toContain("8000");
  });

  it("generates AI context files", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: [],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceAiContext(config, registry);

    expect(await fs.pathExists(path.join(targetDir, "CLAUDE.md"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, ".cursorrules"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "AI_CONTEXT.md"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, ".github", "copilot.md"))).toBe(true);

    // Verify CLAUDE.md contains project name
    const claudeMd = await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("test-project");
    expect(claudeMd).toContain("FastAPI");
  });

  it("generates doctor script with correct checks", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: [],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceDoctor(config, registry);

    const doctorPath = path.join(targetDir, "scripts", "doctor.sh");
    expect(await fs.pathExists(doctorPath)).toBe(true);

    // Verify executable
    const stat = await fs.stat(doctorPath);
    expect(stat.mode & 0o100).toBeTruthy();

    // Verify contains python check (since backend is FastAPI / python)
    const content = await fs.readFile(doctorPath, "utf-8");
    expect(content).toContain("Python");
    expect(content).toContain("pip");
  });

  it("generates doctor script with docker checks when docker enhancement is selected", async () => {
    const config: ProjectConfig = {
      name: "test-project",
      type: "backend",
      backend: "fastapi",
      enhancements: ["docker"],
      targetDir,
    };

    await fs.ensureDir(targetDir);
    await enhanceDoctor(config, registry);

    const content = await fs.readFile(
      path.join(targetDir, "scripts", "doctor.sh"),
      "utf-8",
    );
    expect(content).toContain("Docker");
  });

  it("full pipeline: scaffold + scripts + docker + ai-context + doctor", async () => {
    const config: ProjectConfig = {
      name: "full-pipeline-test",
      type: "backend",
      backend: "fastapi",
      enhancements: ["docker", "ai-context"],
      targetDir,
    };

    await scaffold(config, registry);
    await enhanceScripts(config, registry);
    await enhanceDocker(config, registry);
    await enhanceAiContext(config, registry);
    await enhanceDoctor(config, registry);

    // Scaffold output
    expect(await fs.pathExists(path.join(targetDir, "app", "main.py"))).toBe(true);

    // Scripts
    expect(await fs.pathExists(path.join(targetDir, "scripts", "dev.sh"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "Makefile"))).toBe(true);

    // Docker
    expect(await fs.pathExists(path.join(targetDir, "Dockerfile"))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, "docker-compose.yml"))).toBe(true);

    // AI context
    expect(await fs.pathExists(path.join(targetDir, "CLAUDE.md"))).toBe(true);

    // Doctor
    expect(await fs.pathExists(path.join(targetDir, "scripts", "doctor.sh"))).toBe(true);
  });
});
