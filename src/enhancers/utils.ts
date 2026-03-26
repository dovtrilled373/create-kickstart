import fs from "fs-extra";
import path from "path";
import { ProjectConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Directory resolution — used by 7+ enhancers
// ---------------------------------------------------------------------------

export const PRIMARY_BACKEND_NAME = "api";

export function resolveProjectDirs(config: ProjectConfig) {
  const isFullstack = config.type === "fullstack";
  return {
    isFullstack,
    beDir: isFullstack ? path.join(config.targetDir, "backend", PRIMARY_BACKEND_NAME) : config.targetDir,
    backendRoot: path.join(config.targetDir, "backend"),
    feDir: isFullstack ? path.join(config.targetDir, "frontend") : config.targetDir,
    mobileDir: isFullstack ? path.join(config.targetDir, "mobile") : config.targetDir,
  };
}

// ---------------------------------------------------------------------------
// .env.example append — used by 5+ enhancers
// ---------------------------------------------------------------------------

export async function appendEnvVars(
  targetDir: string,
  guard: string,
  block: string,
): Promise<void> {
  const envPath = path.join(targetDir, ".env.example");
  if (!(await fs.pathExists(envPath))) return;
  const contents = await fs.readFile(envPath, "utf-8");
  if (!contents.includes(guard)) {
    await fs.appendFile(envPath, block);
  }
}

// ---------------------------------------------------------------------------
// Auto-register a router into FastAPI's main.py
// ---------------------------------------------------------------------------

export async function autoRegisterFastapiRoute(
  beDir: string,
  importLine: string,
  registerLine: string,
): Promise<void> {
  const mainPath = path.join(beDir, "app", "main.py");
  if (!(await fs.pathExists(mainPath))) return;

  let content = await fs.readFile(mainPath, "utf-8");
  if (content.includes(importLine)) return;

  // Insert import after last import line
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("from ") || lines[i].startsWith("import ")) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }

  // Insert register line after existing include_router or after app = FastAPI(...)
  content = lines.join("\n");
  if (content.includes("app.include_router(")) {
    content = content.replace(
      /(app\.include_router\([^)]+\)\n)/,
      `$1${registerLine}\n`,
    );
  } else {
    content = content.replace(
      /(app\s*=\s*FastAPI\([^)]*\))/,
      `$1\n\n${registerLine}`,
    );
  }

  await fs.writeFile(mainPath, content);
}

// ---------------------------------------------------------------------------
// Auto-register a router into Express's index.ts
// ---------------------------------------------------------------------------

export async function autoRegisterExpressRoute(
  beDir: string,
  importLine: string,
  mountLine: string,
): Promise<void> {
  const indexPath = path.join(beDir, "src", "index.ts");
  if (!(await fs.pathExists(indexPath))) return;

  let content = await fs.readFile(indexPath, "utf-8");
  if (content.includes(importLine)) return;

  // Insert import after last import line
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  }

  content = lines.join("\n");

  // Mount router before app.listen
  content = content.replace(/(app\.listen)/, `${mountLine}\n\n$1`);

  await fs.writeFile(indexPath, content);
}
