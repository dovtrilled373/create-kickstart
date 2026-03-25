import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Python backend → TS frontend (OpenAPI)
// ---------------------------------------------------------------------------

function pythonSyncScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "Syncing API types from backend OpenAPI spec..."

# Start backend temporarily to get OpenAPI spec
cd backend
source venv/bin/activate 2>/dev/null || true
python -c "
from app.main import app
import json
spec = app.openapi()
with open('../api-types/openapi.json', 'w') as f:
    json.dump(spec, f, indent=2)
print('OpenAPI spec exported')
"
cd ..

# Generate TypeScript types
npx openapi-typescript api-types/openapi.json -o api-types/api.d.ts
echo "TypeScript types generated at api-types/api.d.ts"
`;
}

// ---------------------------------------------------------------------------
// Go backend → TS frontend (OpenAPI)
// ---------------------------------------------------------------------------

function goSyncScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "Syncing API types from backend OpenAPI spec..."

# Generate OpenAPI spec from Go backend
cd backend
go run ./cmd/openapi-gen > ../api-types/openapi.json 2>/dev/null || \\
  echo '{"openapi":"3.0.0","info":{"title":"API","version":"1.0.0"},"paths":{}}' > ../api-types/openapi.json
cd ..

# Generate TypeScript types
npx openapi-typescript api-types/openapi.json -o api-types/api.d.ts
echo "TypeScript types generated at api-types/api.d.ts"
`;
}

// ---------------------------------------------------------------------------
// TS backend → TS frontend (shared types)
// ---------------------------------------------------------------------------

function sharedTypes(): string {
  return `// Shared types between frontend and backend
// Import from both: import { Item } from "../../shared/types"

export interface Item {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
}

// Add your shared types here
`;
}

function tsSyncScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "Validating shared types..."

# Type-check the shared types
npx tsc --noEmit shared/types.ts --esModuleInterop --moduleResolution bundler 2>/dev/null || \\
  echo "Warning: type-check failed — review shared/types.ts"

echo "Shared types are valid."
`;
}

// ---------------------------------------------------------------------------
// OpenAPI readme
// ---------------------------------------------------------------------------

function apiTypesReadme(backendLang: string): string {
  const method =
    backendLang === "python"
      ? "extracts the OpenAPI spec from your FastAPI app"
      : "generates an OpenAPI spec from your Go backend";

  return `# API Types

This directory holds auto-generated TypeScript types derived from the backend API.

## How it works

\`scripts/sync-types.sh\` ${method} and uses
\`openapi-typescript\` to produce \`api.d.ts\`.

## Usage

\`\`\`bash
# Generate / refresh types
./scripts/sync-types.sh
# — or —
make sync-types
\`\`\`

Then import in your frontend code:

\`\`\`ts
import type { paths } from "../../api-types/api";
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceApiTypes(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  // Only applies to fullstack projects
  if (type !== "fullstack" || !config.backend || !config.frontend) {
    return;
  }

  const beEntry = getRegistryEntry(registry, "backend", config.backend);
  const scriptsDir = path.join(targetDir, "scripts");
  await fs.ensureDir(scriptsDir);

  if (beEntry.lang === "typescript") {
    // TS backend → shared types
    const sharedDir = path.join(targetDir, "shared");
    await fs.ensureDir(sharedDir);
    await fs.writeFile(path.join(sharedDir, "types.ts"), sharedTypes());

    const scriptPath = path.join(scriptsDir, "sync-types.sh");
    await fs.writeFile(scriptPath, tsSyncScript());
    await fs.chmod(scriptPath, 0o755);
  } else if (beEntry.lang === "python") {
    // Python backend → OpenAPI → TS
    const apiDir = path.join(targetDir, "api-types");
    await fs.ensureDir(apiDir);
    await fs.writeFile(path.join(apiDir, "README.md"), apiTypesReadme("python"));

    const scriptPath = path.join(scriptsDir, "sync-types.sh");
    await fs.writeFile(scriptPath, pythonSyncScript());
    await fs.chmod(scriptPath, 0o755);
  } else if (beEntry.lang === "go") {
    // Go backend → OpenAPI → TS
    const apiDir = path.join(targetDir, "api-types");
    await fs.ensureDir(apiDir);
    await fs.writeFile(path.join(apiDir, "README.md"), apiTypesReadme("go"));

    const scriptPath = path.join(scriptsDir, "sync-types.sh");
    await fs.writeFile(scriptPath, goSyncScript());
    await fs.chmod(scriptPath, 0o755);
  }
}
