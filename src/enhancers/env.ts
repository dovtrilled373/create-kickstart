import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

export async function enhanceEnv(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;
  const hasDb = config.enhancements.includes("db");

  const lines: string[] = [
    "# Environment variables",
    "NODE_ENV=development",
    "",
  ];

  if (type === "fullstack") {
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      lines.push(`# Frontend`);
      lines.push(`FRONTEND_PORT=${feEntry.port}`);
      lines.push("");
    }
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      lines.push(`# Backend`);
      lines.push(`BACKEND_PORT=${beEntry.port}`);
      lines.push("");
    }
  } else {
    const entry = resolveEntry(config, registry);
    if (entry && entry.port > 0) {
      lines.push(`PORT=${entry.port}`);
      lines.push("");
    }
  }

  // DB env vars are added by the db enhancer with the correct database type

  const content = lines.join("\n") + "\n";
  await Promise.all([
    fs.writeFile(path.join(targetDir, ".env.example"), content),
    fs.writeFile(path.join(targetDir, ".env"), content),
  ]);

  // Ensure .env is in .gitignore
  const gitignorePath = path.join(targetDir, ".gitignore");
  if (await fs.pathExists(gitignorePath)) {
    const existing = await fs.readFile(gitignorePath, "utf-8");
    if (!existing.includes(".env")) {
      await fs.appendFile(gitignorePath, "\n.env\n");
    }
  } else {
    await fs.writeFile(gitignorePath, ".env\n");
  }
}

function resolveEntry(config: ProjectConfig, registry: Registry) {
  if (config.frontend) return getRegistryEntry(registry, "frontend", config.frontend);
  if (config.backend) return getRegistryEntry(registry, "backend", config.backend);
  if (config.standalone) return getRegistryEntry(registry, "standalone", config.standalone);
  return null;
}
