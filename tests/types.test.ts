import { describe, it, expect } from "vitest";
import type {
  ProjectType,
  FrontendStack,
  BackendStack,
  StandaloneStack,
  Enhancement,
  ProjectConfig,
  RegistryEntry,
  Registry,
} from "../src/types.js";

describe("types smoke tests", () => {
  it("ProjectConfig accepts valid configuration", () => {
    const config: ProjectConfig = {
      name: "my-app",
      type: "fullstack",
      frontend: "nextjs",
      backend: "fastapi",
      enhancements: ["docker", "ci"],
      targetDir: "/tmp/my-app",
    };

    expect(config.name).toBe("my-app");
    expect(config.type).toBe("fullstack");
    expect(config.enhancements).toHaveLength(2);
  });

  it("ProjectConfig accepts backend-only configuration", () => {
    const config: ProjectConfig = {
      name: "api-service",
      type: "backend",
      backend: "express",
      enhancements: [],
      targetDir: "/tmp/api-service",
    };

    expect(config.type).toBe("backend");
    expect(config.frontend).toBeUndefined();
    expect(config.backend).toBe("express");
  });

  it("ProjectConfig accepts standalone configuration", () => {
    const config: ProjectConfig = {
      name: "my-cli",
      type: "cli-lib",
      standalone: "python-cli",
      enhancements: ["lint", "test"],
      targetDir: "/tmp/my-cli",
    };

    expect(config.type).toBe("cli-lib");
    expect(config.standalone).toBe("python-cli");
  });

  it("RegistryEntry has all expected fields", () => {
    const entry: RegistryEntry = {
      name: "Test Stack",
      scaffoldType: "template",
      port: 3000,
      lang: "typescript",
      devCmd: "npm run dev",
      buildCmd: "npm run build",
      testCmd: "npm test",
      lintConfig: "eslint-prettier",
    };

    expect(entry.name).toBe("Test Stack");
    expect(entry.port).toBe(3000);
    expect(entry.lang).toBe("typescript");
  });

  it("Registry has version and all category maps", () => {
    const registry: Registry = {
      version: "1.0.0",
      frontend: {},
      backend: {},
      standalone: {},
    };

    expect(registry.version).toBe("1.0.0");
    expect(registry.frontend).toBeDefined();
    expect(registry.backend).toBeDefined();
    expect(registry.standalone).toBeDefined();
  });

  it("Enhancement type covers expected values", () => {
    const enhancements: Enhancement[] = [
      "docker",
      "ci",
      "lint",
      "test",
      "env",
      "ai-context",
      "pre-commit",
      "db",
      "api-wiring",
      "sample-crud",
      "doctor",
      "logging",
      "deploy",
      "deps-auto",
      "api-types",
    ];

    expect(enhancements).toHaveLength(15);
  });

  it("all ProjectType values are valid", () => {
    const types: ProjectType[] = ["fullstack", "frontend", "backend", "cli-lib"];
    expect(types).toHaveLength(4);
  });

  it("all FrontendStack values are valid", () => {
    const stacks: FrontendStack[] = ["nextjs", "react-vite", "vue", "svelte", "angular"];
    expect(stacks).toHaveLength(5);
  });

  it("all BackendStack values are valid", () => {
    const stacks: BackendStack[] = [
      "fastapi",
      "express",
      "hono",
      "django",
      "go-chi",
      "spring-boot",
    ];
    expect(stacks).toHaveLength(6);
  });

  it("all StandaloneStack values are valid", () => {
    const stacks: StandaloneStack[] = ["python-cli", "python-lib", "node-cli"];
    expect(stacks).toHaveLength(3);
  });
});
