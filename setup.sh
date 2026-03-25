#!/usr/bin/env bash
set -euo pipefail

# create-kickstart bootstrapper
# Usage: curl -fsSL https://raw.githubusercontent.com/.../setup.sh | bash -s -- [options]

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${BLUE}[kickstart]${NC} $1"; }
ok()    { echo -e "${GREEN}[kickstart]${NC} $1"; }
err()   { echo -e "${RED}[kickstart]${NC} $1" >&2; }

# Parse arguments
NAME=""
TYPE=""
FRONTEND=""
BACKEND=""
WITH="docker,ci,lint,test,env,ai-context"
STANDALONE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --name)       NAME="$2"; shift 2 ;;
    --type)       TYPE="$2"; shift 2 ;;
    --frontend)   FRONTEND="$2"; shift 2 ;;
    --backend)    BACKEND="$2"; shift 2 ;;
    --standalone) STANDALONE="$2"; shift 2 ;;
    --with)       WITH="$2"; shift 2 ;;
    --help)
      echo "Usage: curl -fsSL <url>/setup.sh | bash -s -- --name my-app --type fullstack --frontend nextjs --backend fastapi"
      echo ""
      echo "Options:"
      echo "  --name <name>         Project name (required)"
      echo "  --type <type>         fullstack, frontend, backend, cli-lib"
      echo "  --frontend <stack>    nextjs, react-vite, vue, svelte, angular"
      echo "  --backend <stack>     fastapi, express, hono, django, go-chi, spring-boot"
      echo "  --with <enhancements> Comma-separated (default: docker,ci,lint,test,env,ai-context)"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$NAME" ]; then
  err "Project name is required. Use --name <name>"
  exit 1
fi

if [ -z "$TYPE" ]; then
  err "Project type is required. Use --type <type> (fullstack, frontend, backend, cli-lib)"
  exit 1
fi

# Check for Node.js
if command -v node &> /dev/null && command -v npx &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    log "Found Node.js v$(node -v | cut -d'v' -f2), using npx..."

    CMD="npx create-kickstart@latest $NAME --type $TYPE --with $WITH --no-interactive"
    [ -n "$FRONTEND" ] && CMD="$CMD --frontend $FRONTEND"
    [ -n "$BACKEND" ] && CMD="$CMD --backend $BACKEND"
    [ -n "$STANDALONE" ] && CMD="$CMD --standalone $STANDALONE"

    eval "$CMD"
    exit $?
  fi
fi

err "Node.js >= 18 is required. Install from https://nodejs.org/"
exit 1
