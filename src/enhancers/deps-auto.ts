import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// YAML builder helpers
// ---------------------------------------------------------------------------

function dependabotEntry(ecosystem: string, directory: string): string {
  return `  - package-ecosystem: "${ecosystem}"
    directory: "${directory}"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
    open-pull-requests-limit: 10
`;
}

function langToEcosystem(lang: string): string {
  switch (lang) {
    case "python":
      return "pip";
    case "go":
      return "gomod";
    default:
      return "npm";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDepsAuto(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  const entries: string[] = [];

  if (type === "fullstack") {
    // Frontend
    if (config.frontend) {
      const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
      entries.push(dependabotEntry(langToEcosystem(feEntry.lang), "/frontend"));
    }

    // Backend
    if (config.backend) {
      const beEntry = getRegistryEntry(registry, "backend", config.backend);
      entries.push(dependabotEntry(langToEcosystem(beEntry.lang), "/backend"));
    }
  } else if (config.frontend) {
    const feEntry = getRegistryEntry(registry, "frontend", config.frontend);
    entries.push(dependabotEntry(langToEcosystem(feEntry.lang), "/"));
  } else if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    entries.push(dependabotEntry(langToEcosystem(beEntry.lang), "/"));
  } else if (config.standalone) {
    const entry = getRegistryEntry(registry, "standalone", config.standalone);
    entries.push(dependabotEntry(langToEcosystem(entry.lang), "/"));
  }

  // Always add github-actions
  entries.push(dependabotEntry("github-actions", "/"));

  const content = `version: 2
updates:
${entries.join("\n")}`;

  const ghDir = path.join(targetDir, ".github");
  await fs.ensureDir(ghDir);
  await fs.writeFile(path.join(ghDir, "dependabot.yml"), content);
}
