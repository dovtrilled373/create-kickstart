import { describe, it, expect } from "vitest";
import { loadRegistry, getRegistryEntry } from "../src/registry.js";
import type { Registry } from "../src/types.js";

describe("loadRegistry", () => {
  it("returns a valid Registry object with frontend/backend/standalone", async () => {
    const registry = await loadRegistry();

    expect(registry).toBeDefined();
    expect(registry.version).toBeDefined();
    expect(registry.frontend).toBeDefined();
    expect(registry.backend).toBeDefined();
    expect(registry.standalone).toBeDefined();
  });

  it("contains expected frontend stacks", async () => {
    const registry = await loadRegistry();

    expect(registry.frontend).toHaveProperty("nextjs");
    expect(registry.frontend).toHaveProperty("react-vite");
    expect(registry.frontend).toHaveProperty("vue");
  });

  it("contains expected backend stacks", async () => {
    const registry = await loadRegistry();

    expect(registry.backend).toHaveProperty("fastapi");
    expect(registry.backend).toHaveProperty("express");
    expect(registry.backend).toHaveProperty("go-chi");
  });
});

describe("getRegistryEntry", () => {
  let registry: Registry;

  beforeAll(async () => {
    registry = await loadRegistry();
  });

  it("returns nextjs entry with port 3000", () => {
    const entry = getRegistryEntry(registry, "frontend", "nextjs");

    expect(entry.name).toBe("Next.js");
    expect(entry.port).toBe(3000);
    expect(entry.lang).toBe("typescript");
  });

  it("returns fastapi entry with lang python", () => {
    const entry = getRegistryEntry(registry, "backend", "fastapi");

    expect(entry.name).toBe("FastAPI");
    expect(entry.lang).toBe("python");
    expect(entry.port).toBe(8000);
  });

  it("returns express entry with correct port", () => {
    const entry = getRegistryEntry(registry, "backend", "express");

    expect(entry.name).toBe("Express");
    expect(entry.port).toBe(3001);
  });

  it("throws Error for nonexistent backend stack", () => {
    expect(() => getRegistryEntry(registry, "backend", "nonexistent")).toThrow(
      "Unknown backend stack: nonexistent",
    );
  });

  it("throws Error for nonexistent category", () => {
    expect(() => getRegistryEntry(registry, "invalid", "nextjs")).toThrow();
  });
});
