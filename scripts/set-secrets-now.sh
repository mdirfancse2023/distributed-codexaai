#!/usr/bin/env bash
# Run this ONCE after: gh auth login
# Sets all GitHub secrets for mdirfancse2023/distributed-codexaai
# Fill in the values below before running (or export them as env vars).
#
# Usage:
#   DOCKERHUB_TOKEN=xxx AI_API_KEY=sk-xxx GIT_PASSWORD=ghp_xxx ./scripts/set-secrets-now.sh

set -euo pipefail
REPO="mdirfancse2023/distributed-codexaai"

s() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then echo "  SKIP $name (empty)"; return; fi
  echo "$value" | gh secret set "$name" --repo "$REPO" --body -
  echo "  SET  $name"
}

echo "Setting GitHub secrets for $REPO..."

# ── Azure (get AZURE_CREDENTIALS from: az ad sp create-for-rbac --sdk-auth) ──
s AZURE_CREDENTIALS    "${AZURE_CREDENTIALS:?Set AZURE_CREDENTIALS env var}"
s AZURE_RESOURCE_GROUP "codexa-rg"
s AZURE_AKS_CLUSTER    "codexa-aks"

# ── Docker Hub ────────────────────────────────────────────────────────────────
s DOCKERHUB_USERNAME "mdirfancse2023"
s DOCKERHUB_TOKEN    "${DOCKERHUB_TOKEN:?Set DOCKERHUB_TOKEN env var}"

# ── Domains (ingress IP: 20.204.189.207) ─────────────────────────────────────
s CODEXA_APP_HOST       "codexaai.virtualgyans.tech"
s CODEXA_API_HOST       "app.virtualgyans.tech"
s CODEXA_PREVIEW_DOMAIN "previews.virtualgyans.tech"
s CODEXA_API_URL        "https://codexaai.virtualgyans.tech"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
s POSTGRES_PASSWORD        "CoDeXa@Pg#2026!Root"
s ACCOUNT_DB_PASSWORD      "CoDeXa@Acc#2026!"
s WORKSPACE_DB_PASSWORD    "CoDeXa@Wsp#2026!"
s INTELLIGENCE_DB_PASSWORD "CoDeXa@Int#2026!"

# ── MinIO ─────────────────────────────────────────────────────────────────────
s MINIO_ROOT_USER     "minioadmin"
s MINIO_ROOT_PASSWORD "CoDeXa@MinIO#2026!"

# ── Application ───────────────────────────────────────────────────────────────
s JWT_SECRET         "CoDeXaAI-JWT-Secret-Key-2026-Production-Min32Chars!"
s STRIPE_API_KEY     "${STRIPE_API_KEY:-}"
s STRIPE_WEBHOOK_SECRET "${STRIPE_WEBHOOK_SECRET:-}"
s AI_API_KEY         "${AI_API_KEY:?Set AI_API_KEY env var}"

# ── Config Server ─────────────────────────────────────────────────────────────
s GIT_USERNAME "mdirfancse2023"
s GIT_PASSWORD "${GIT_PASSWORD:?Set GIT_PASSWORD env var}"

# ── Frontend ──────────────────────────────────────────────────────────────────
s VITE_UNSPLASH_ACCESS_KEY "${VITE_UNSPLASH_ACCESS_KEY:-}"

echo ""
echo "All secrets set! Trigger bootstrap:"
echo "  gh workflow run bootstrap-aks-cluster.yaml --repo $REPO --ref main"
