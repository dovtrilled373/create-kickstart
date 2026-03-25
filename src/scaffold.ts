import * as p from "@clack/prompts";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { ProjectConfig, Registry, RegistryEntry } from "./types.js";
import { getRegistryEntry } from "./registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve the templates directory — works in dev (src/) and published (dist/) layouts. */
function getTemplatesDir(): string {
  const candidates = [
    path.join(__dirname, "..", "src", "templates"),
    path.join(__dirname, "..", "templates"),
    path.join(__dirname, "templates"),
  ];
  for (const c of candidates) {
    if (fs.pathExistsSync(c)) return c;
  }
  return candidates[0];
}

const TEMPLATES_DIR = getTemplatesDir();

// ---------------------------------------------------------------------------
// Template variable replacement
// ---------------------------------------------------------------------------

/** Replace all template variables in a string. */
function replaceVars(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/** Recursively copy a template directory, replacing vars in every text file. */
async function copyTemplate(
  templateDir: string,
  targetDir: string,
  vars: Record<string, string>,
): Promise<void> {
  await fs.ensureDir(targetDir);
  const entries = await fs.readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);
    const destPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, vars);
    } else {
      const content = await fs.readFile(srcPath, "utf-8");
      const replaced = replaceVars(content, vars);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, replaced, "utf-8");
    }
  }
}

// ---------------------------------------------------------------------------
// CLI-based scaffolding (e.g. create-next-app)
// ---------------------------------------------------------------------------

async function scaffoldWithCli(
  entry: RegistryEntry,
  targetDir: string,
  projectName: string,
): Promise<void> {
  if (!entry.scaffoldCmd) {
    throw new Error(`Registry entry "${entry.name}" has scaffoldType "cli" but no scaffoldCmd`);
  }

  const cmd = replaceVars(entry.scaffoldCmd, { name: projectName });
  const [bin, ...args] = cmd.split(" ");

  await execa(bin, args, {
    cwd: path.dirname(targetDir),
    stdio: "pipe",
  });
}

// ---------------------------------------------------------------------------
// Template-based scaffolding (FastAPI, Express, Go Chi, etc.)
// ---------------------------------------------------------------------------

async function scaffoldWithTemplate(
  stackKey: string,
  targetDir: string,
  projectName: string,
): Promise<void> {
  const templateDir = path.join(TEMPLATES_DIR, stackKey);
  if (!(await fs.pathExists(templateDir))) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  const vars: Record<string, string> = {
    name: projectName,
    PROJECT_NAME: projectName,
  };

  await copyTemplate(templateDir, targetDir, vars);
}

// ---------------------------------------------------------------------------
// Single-stack scaffolder (dispatches cli vs template)
// ---------------------------------------------------------------------------

async function scaffoldStack(
  registry: Registry,
  category: "frontend" | "backend" | "standalone",
  stackKey: string,
  targetDir: string,
  projectName: string,
): Promise<void> {
  const entry = getRegistryEntry(registry, category, stackKey);

  if (entry.scaffoldType === "cli") {
    await scaffoldWithCli(entry, targetDir, projectName);
  } else {
    await scaffoldWithTemplate(stackKey, targetDir, projectName);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scaffold(
  config: ProjectConfig,
  registry: Registry,
): Promise<void> {
  const { name, type, targetDir } = config;

  await fs.ensureDir(targetDir);

  // ── fullstack ─────────────────────────────────────────────────────────
  if (type === "fullstack") {
    if (!config.frontend || !config.backend) {
      throw new Error("Fullstack projects require both frontend and backend stacks");
    }

    // Frontend
    const feDir = path.join(targetDir, "frontend");
    const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
    const s1 = p.spinner();
    s1.start(`Scaffolding frontend (${feEntry.name})…`);
    try {
      if (feEntry.scaffoldType === "cli") {
        // CLI scaffolders create the directory themselves, so we scaffold
        // into targetDir and let the CLI name the folder "frontend".
        await scaffoldWithCli(feEntry, feDir, "frontend");
      } else {
        await scaffoldWithTemplate(config.frontend, feDir, name);
      }
      s1.stop(`Frontend (${feEntry.name}) scaffolded`);
    } catch (err) {
      s1.stop(`Frontend scaffolding failed`);
      throw err;
    }

    // Backend
    const beDir = path.join(targetDir, "backend");
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const s2 = p.spinner();
    s2.start(`Scaffolding backend (${beEntry.name})…`);
    try {
      if (beEntry.scaffoldType === "cli") {
        await scaffoldWithCli(beEntry, beDir, "backend");
      } else {
        await scaffoldWithTemplate(config.backend, beDir, name);
      }
      s2.stop(`Backend (${beEntry.name}) scaffolded`);
    } catch (err) {
      s2.stop(`Backend scaffolding failed`);
      throw err;
    }

    return;
  }

  // ── frontend-only ─────────────────────────────────────────────────────
  if (type === "frontend") {
    if (!config.frontend) throw new Error("Frontend project requires a frontend stack");
    const entry = getRegistryEntry(registry, "frontend", config.frontend);
    const s = p.spinner();
    s.start(`Scaffolding ${entry.name}…`);
    try {
      await scaffoldStack(registry, "frontend", config.frontend, targetDir, name);
      s.stop(`${entry.name} scaffolded`);
    } catch (err) {
      s.stop(`Scaffolding failed`);
      throw err;
    }
    return;
  }

  // ── backend-only ──────────────────────────────────────────────────────
  if (type === "backend") {
    if (!config.backend) throw new Error("Backend project requires a backend stack");
    const entry = getRegistryEntry(registry, "backend", config.backend);
    const s = p.spinner();
    s.start(`Scaffolding ${entry.name}…`);
    try {
      await scaffoldStack(registry, "backend", config.backend, targetDir, name);
      s.stop(`${entry.name} scaffolded`);
    } catch (err) {
      s.stop(`Scaffolding failed`);
      throw err;
    }
    return;
  }

  // ── cli-lib / standalone ──────────────────────────────────────────────
  if (type === "cli-lib") {
    if (!config.standalone) throw new Error("CLI/Lib project requires a standalone stack");
    const entry = getRegistryEntry(registry, "standalone", config.standalone);
    const s = p.spinner();
    s.start(`Scaffolding ${entry.name}…`);
    try {
      await scaffoldStack(registry, "standalone", config.standalone, targetDir, name);
      s.stop(`${entry.name} scaffolded`);
    } catch (err) {
      s.stop(`Scaffolding failed`);
      throw err;
    }
    return;
  }

  throw new Error(`Unknown project type: ${type}`);
}
