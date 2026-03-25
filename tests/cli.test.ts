import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses fullstack config with all flags", () => {
    const result = parseArgs([
      "node",
      "script",
      "my-app",
      "--type",
      "fullstack",
      "--frontend",
      "nextjs",
      "--backend",
      "fastapi",
      "--with",
      "docker,ci",
      "--no-interactive",
    ]);

    expect(result.name).toBe("my-app");
    expect(result.type).toBe("fullstack");
    expect(result.frontend).toBe("nextjs");
    expect(result.backend).toBe("fastapi");
    expect(result.enhancements).toEqual(["docker", "ci"]);
    expect(result.interactive).toBe(false);
  });

  it("returns interactive: true when no args provided", () => {
    const result = parseArgs(["node", "script"]);

    expect(result.name).toBeUndefined();
    expect(result.interactive).toBe(true);
  });

  it("parses backend-only config", () => {
    const result = parseArgs([
      "node",
      "script",
      "app",
      "--type",
      "backend",
      "--backend",
      "express",
      "--no-interactive",
    ]);

    expect(result.name).toBe("app");
    expect(result.type).toBe("backend");
    expect(result.backend).toBe("express");
    expect(result.frontend).toBeUndefined();
    expect(result.interactive).toBe(false);
  });

  it("splits --with into Enhancement array", () => {
    const result = parseArgs([
      "node",
      "script",
      "app",
      "--with",
      "docker,ci,lint,test,env",
      "--no-interactive",
    ]);

    expect(result.enhancements).toEqual(["docker", "ci", "lint", "test", "env"]);
  });

  it("returns empty enhancements when --with is not provided", () => {
    const result = parseArgs(["node", "script", "app", "--no-interactive"]);

    expect(result.enhancements).toEqual([]);
  });

  it("handles --with with spaces around commas", () => {
    const result = parseArgs([
      "node",
      "script",
      "app",
      "--with",
      "docker, ci, lint",
      "--no-interactive",
    ]);

    expect(result.enhancements).toEqual(["docker", "ci", "lint"]);
  });
});
