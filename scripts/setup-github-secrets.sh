#!/usr/bin/env bash
# =============================================================================
# setup-github-secrets.sh
# Sets all required GitHub repository secrets for Codexa AI AKS deployment.
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated  →  gh auth login
#   - .env file created from .env.example with real values
#   - Azure resources already created (run create-azure-resources.sh first)
#
# Usage:
#   cp .env.example .env
#   # Edit .env with real values
#   chmod +x scripts/setup-github-secrets.sh
#   ./scripts/setup-github-secrets.sh
#
# The script reads from .env plus prompts for Azure/Docker Hub credentials.
# =============================================================================

set -euo pipefail

info()    { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m    $*"; }
die()     { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || die "'$1' is not installed. Please install it first."
}

require gh

# ---------------------------------------------------------------------------
# Check gh auth
# ---------------------------------------------------------------------------
gh auth status &>/dev/null || die "Not authenticated. Run: gh auth login"

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
ENV_FILE="${1:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  die ".env file not found. Copy .env.example to .env and fill in values."
fi

info "Loading secrets from $ENV_FILE..."
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# ---------------------------------------------------------------------------
# Detect repo
# ---------------------------------------------------------------------------
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [[ -z "$REPO" ]]; then
  die "Could not detect GitHub repository. Run from inside the repo directory."
fi
info "Target repository: $REPO"

# ---------------------------------------------------------------------------
# Helper: set secret
# ---------------------------------------------------------------------------
set_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  [SKIP] $name is empty — skipping"
    return
  fi
  echo "$value" | gh secret set "$name" --repo "$REPO" --body -
  echo "  [SET]  $name"
}

# ---------------------------------------------------------------------------
# Azure secrets (prompt if not in env)
# ---------------------------------------------------------------------------
echo ""
info "Azure credentials (paste the JSON from create-azure-resources.sh output):"
if [[ -z "${AZURE_CREDENTIALS:-}" ]]; then
  echo "Paste AZURE_CREDENTIALS JSON (end with a blank line):"
  AZURE_CREDENTIALS=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && break
    AZURE_CREDENTIALS+="$line"$'\n'
  done
fi

if [[ -z "${AZURE_RESOURCE_GROUP:-}" ]]; then
  read -rp "AZURE_RESOURCE_GROUP (e.g. codexa-rg): " AZURE_RESOURCE_GROUP
fi

if [[ -z "${AZURE_AKS_CLUSTER:-}" ]]; then
  read -rp "AZURE_AKS_CLUSTER (e.g. codexa-aks): " AZURE_AKS_CLUSTER
fi

# ---------------------------------------------------------------------------
# Docker Hub secrets (prompt if not in env)
# ---------------------------------------------------------------------------
if [[ -z "${DOCKERHUB_USERNAME:-}" ]]; then
  read -rp "DOCKERHUB_USERNAME: " DOCKERHUB_USERNAME
fi

if [[ -z "${DOCKERHUB_TOKEN:-}" ]]; then
  read -rsp "DOCKERHUB_TOKEN: " DOCKERHUB_TOKEN
  echo ""
fi

# ---------------------------------------------------------------------------
# Domain secrets (prompt if not in env)
# ---------------------------------------------------------------------------
if [[ -z "${CODEXA_APP_HOST:-}" ]]; then
  read -rp "CODEXA_APP_HOST (e.g. codexa.1.2.3.4.sslip.io): " CODEXA_APP_HOST
fi

if [[ -z "${CODEXA_API_HOST:-}" ]]; then
  read -rp "CODEXA_API_HOST (e.g. api.1.2.3.4.sslip.io): " CODEXA_API_HOST
fi

if [[ -z "${CODEXA_PREVIEW_DOMAIN:-}" ]]; then
  read -rp "CODEXA_PREVIEW_DOMAIN (e.g. previews.1.2.3.4.sslip.io): " CODEXA_PREVIEW_DOMAIN
fi

CODEXA_API_URL="${CODEXA_API_URL:-https://${CODEXA_API_HOST}}"

# ---------------------------------------------------------------------------
# Optional: Unsplash key for frontend
# ---------------------------------------------------------------------------
if [[ -z "${VITE_UNSPLASH_ACCESS_KEY:-}" ]]; then
  read -rp "VITE_UNSPLASH_ACCESS_KEY (optional, press Enter to skip): " VITE_UNSPLASH_ACCESS_KEY || true
fi

# ---------------------------------------------------------------------------
# Set all secrets
# ---------------------------------------------------------------------------
echo ""
info "Setting GitHub secrets..."

# Azure
set_secret "AZURE_CREDENTIALS"    "$AZURE_CREDENTIALS"
set_secret "AZURE_RESOURCE_GROUP" "$AZURE_RESOURCE_GROUP"
set_secret "AZURE_AKS_CLUSTER"    "$AZURE_AKS_CLUSTER"

# Docker Hub
set_secret "DOCKERHUB_USERNAME"   "$DOCKERHUB_USERNAME"
set_secret "DOCKERHUB_TOKEN"      "$DOCKERHUB_TOKEN"

# Domains
set_secret "CODEXA_APP_HOST"      "$CODEXA_APP_HOST"
set_secret "CODEXA_API_HOST"      "$CODEXA_API_HOST"
set_secret "CODEXA_PREVIEW_DOMAIN" "$CODEXA_PREVIEW_DOMAIN"
set_secret "CODEXA_API_URL"       "$CODEXA_API_URL"

# PostgreSQL
set_secret "POSTGRES_PASSWORD"         "${POSTGRES_PASSWORD:-}"
set_secret "ACCOUNT_DB_PASSWORD"       "${ACCOUNT_DB_PASSWORD:-}"
set_secret "WORKSPACE_DB_PASSWORD"     "${WORKSPACE_DB_PASSWORD:-}"
set_secret "INTELLIGENCE_DB_PASSWORD"  "${INTELLIGENCE_DB_PASSWORD:-}"

# MinIO
set_secret "MINIO_ROOT_USER"     "${MINIO_ROOT_USER:-}"
set_secret "MINIO_ROOT_PASSWORD" "${MINIO_ROOT_PASSWORD:-}"

# Application
set_secret "JWT_SECRET"              "${JWT_SECRET:-}"
set_secret "STRIPE_API_KEY"          "${STRIPE_API_KEY:-}"
set_secret "STRIPE_WEBHOOK_SECRET"   "${STRIPE_WEBHOOK_SECRET:-}"
set_secret "AI_API_KEY"              "${AI_API_KEY:-}"

# Config server
set_secret "GIT_USERNAME" "${GIT_USERNAME:-}"
set_secret "GIT_PASSWORD" "${GIT_PASSWORD:-}"

# Frontend
set_secret "VITE_UNSPLASH_ACCESS_KEY" "${VITE_UNSPLASH_ACCESS_KEY:-}"

echo ""
success "All secrets set on $REPO"
echo ""
echo "Next steps:"
echo "  1. Go to GitHub Actions → 'Bootstrap AKS Cluster' → Run workflow"
echo "  2. After bootstrap, push to main to trigger per-service deployments"
