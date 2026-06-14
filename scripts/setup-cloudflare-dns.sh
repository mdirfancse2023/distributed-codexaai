#!/usr/bin/env bash
set -euo pipefail

echo "========================================================="
echo "   Cloudflare DNS-01 Secret Setup for Cert-Manager"
echo "========================================================="

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  echo "Error: kubectl is not installed. Please install kubectl first."
  exit 1
fi

# Request credentials if not provided
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  read -rsp "Enter your Cloudflare API Token (Edit DNS Zone permissions): " CLOUDFLARE_API_TOKEN
  echo ""
fi

# 1. Create Secret in cert-manager namespace
echo "Creating credentials secret in cert-manager namespace..."
kubectl create secret generic cloudflare-api-token-secret -n cert-manager \
  --from-literal=api-token="$CLOUDFLARE_API_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "========================================================="
echo "  Cloudflare secret created successfully!"
echo "  Cert-manager will now use this to validate previews SSL."
echo "========================================================="
