import { Registry } from "./types.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/swapnil/create-kickstart/main/registry.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadRegistry(): Promise<Registry> {
  // Try remote first, fall back to local bundled copy
  try {
    const response = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return (await response.json()) as Registry;
    }
  } catch {
    // Network error — fall back to local
  }

  // Fallback: read from bundled registry.json
  const localPath = join(__dirname, "..", "registry.json");
  const data = readFileSync(localPath, "utf-8");
  return JSON.parse(data) as Registry;
}

export function getRegistryEntry(registry: Registry, category: string, key: string) {
  const cat = registry[category as keyof Omit<Registry, "version">];
  if (!cat || !cat[key]) {
    throw new Error(`Unknown ${category} stack: ${key}`);
  }
  return cat[key];
}
