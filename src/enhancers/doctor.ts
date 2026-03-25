import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDoctor(
  config: ProjectConfig,
  registry: Registry,
): Promise<void> {
  const { targetDir, type } = config;

  // Gather info about which stacks are in use
  const checks: string[] = [];
  const portChecks: string[] = [];
  const ports = new Set<number>();

  // Determine which languages/runtimes to check
  const langs = new Set<string>();

  if (type === "fullstack") {
    if (config.frontend) {
      const fe = getRegistryEntry(registry, "frontend", config.frontend);
      langs.add(fe.lang);
      if (fe.port) ports.add(fe.port);
    }
    if (config.backend) {
      const be = getRegistryEntry(registry, "backend", config.backend);
      langs.add(be.lang);
      if (be.port) ports.add(be.port);
    }
  } else if (config.frontend) {
    const fe = getRegistryEntry(registry, "frontend", config.frontend);
    langs.add(fe.lang);
    if (fe.port) ports.add(fe.port);
  } else if (config.backend) {
    const be = getRegistryEntry(registry, "backend", config.backend);
    langs.add(be.lang);
    if (be.port) ports.add(be.port);
  } else if (config.standalone) {
    const st = getRegistryEntry(registry, "standalone", config.standalone);
    langs.add(st.lang);
    if (st.port) ports.add(st.port);
  }

  // Node.js / TypeScript
  if (langs.has("typescript")) {
    checks.push(`check "Node.js" "node" "18"`);
    checks.push(`check "npm" "npm" "9"`);
  }

  // Python
  if (langs.has("python")) {
    checks.push(`check "Python" "python3" "3.10"`);
    checks.push(`check "pip" "pip" "22"`);
  }

  // Go
  if (langs.has("go")) {
    checks.push(`check "Go" "go" "1.21"`);
  }

  // Java
  if (langs.has("java")) {
    checks.push(`check "Java" "java" "17"`);
    checks.push(`check "Maven" "mvn" "3"`);
  }

  // Docker (if enhancement is enabled)
  if (config.enhancements.includes("docker")) {
    checks.push(`check "Docker" "docker" "24"`);
    checks.push(`check "Docker Compose" "docker" "24"  # docker compose is a subcommand`);
  }

  // Git (always useful)
  checks.push(`check "Git" "git" "2"`);

  // Port checks
  for (const port of ports) {
    const service = getServiceName(port, config);
    portChecks.push(`check_port "${port}" "${service}"`);
  }

  const script = buildScript(checks, portChecks);

  const scriptsDir = path.join(targetDir, "scripts");
  await fs.ensureDir(scriptsDir);
  const doctorPath = path.join(scriptsDir, "doctor.sh");
  await fs.writeFile(doctorPath, script);
  await fs.chmod(doctorPath, 0o755);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServiceName(port: number, config: ProjectConfig): string {
  if (config.frontend) {
    // Check common frontend ports
    if (port === 3000 || port === 5173 || port === 4200) return "frontend";
  }
  if (config.backend) {
    if (port === 8000 || port === 8080 || port === 3001) return "backend";
  }
  return `port-${port}`;
}

function buildScript(checks: string[], portChecks: string[]): string {
  let script = `#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1" cmd="$2" min_version="$3"
  if command -v "$cmd" &>/dev/null; then
    local version
    version=$("$cmd" --version 2>&1 | head -1)
    echo -e "  ✅ $name: $version"
    ((PASS++))
  else
    echo -e "  ❌ $name: not found (need $min_version+)"
    ((FAIL++))
  fi
}

check_port() {
  local port="$1" service="$2"
  if lsof -i ":$port" &>/dev/null 2>&1; then
    echo -e "  ⚠️  Port $port ($service): IN USE"
    ((WARN++))
  else
    echo -e "  ✅ Port $port ($service): available"
    ((PASS++))
  fi
}

echo "🔍 Checking development environment..."
echo ""
echo "Required tools:"
`;

  for (const c of checks) {
    script += `${c}\n`;
  }

  if (portChecks.length > 0) {
    script += `\necho ""\necho "Ports:"\n`;
    for (const p of portChecks) {
      script += `${p}\n`;
    }
  }

  script += `
echo ""
echo "────────────────────────────"
echo "  $PASS passed, $FAIL failed, $WARN warnings"
echo "────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
`;

  return script;
}
