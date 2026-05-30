#!/usr/bin/env bash
# =============================================================================
# create-azure-resources.sh
# Provisions all Azure resources needed to run Codexa AI on AKS.
#
# Prerequisites:
#   - Azure CLI (az) installed and logged in  →  az login
#   - kubectl installed
#   - helm installed
#
# Usage:
#   chmod +x scripts/create-azure-resources.sh
#   ./scripts/create-azure-resources.sh
#
# Override defaults by exporting variables before running:
#   export RESOURCE_GROUP=my-rg LOCATION=westeurope ./scripts/create-azure-resources.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configurable defaults — override via environment variables
# ---------------------------------------------------------------------------
RESOURCE_GROUP="${RESOURCE_GROUP:-codexa-rg}"
LOCATION="${LOCATION:-eastus}"
CLUSTER_NAME="${CLUSTER_NAME:-codexa-aks}"
NODE_COUNT="${NODE_COUNT:-2}"
NODE_VM_SIZE="${NODE_VM_SIZE:-Standard_D4s_v3}"
SP_NAME="${SP_NAME:-codexa-github-sp}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()    { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
die()     { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || die "'$1' is not installed. Please install it first."
}

require az
require kubectl
require helm

# ---------------------------------------------------------------------------
# 1. Login check
# ---------------------------------------------------------------------------
info "Checking Azure login..."
az account show &>/dev/null || die "Not logged in. Run: az login"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
success "Logged in. Subscription: $SUBSCRIPTION_ID"

# ---------------------------------------------------------------------------
# 2. Resource Group
# ---------------------------------------------------------------------------
info "Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Resource group ready."

# ---------------------------------------------------------------------------
# 3. AKS Cluster
# ---------------------------------------------------------------------------
info "Creating AKS cluster '$CLUSTER_NAME' (${NODE_COUNT}x ${NODE_VM_SIZE})..."
info "This may take 5-10 minutes..."
az aks create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" \
  --node-count "$NODE_COUNT" \
  --node-vm-size "$NODE_VM_SIZE" \
  --enable-managed-identity \
  --generate-ssh-keys \
  --network-plugin azure \
  --network-policy azure \
  --output none
success "AKS cluster created."

# ---------------------------------------------------------------------------
# 4. Get kubectl credentials
# ---------------------------------------------------------------------------
info "Fetching kubectl credentials..."
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" \
  --overwrite-existing
success "kubectl configured for cluster '$CLUSTER_NAME'."

# ---------------------------------------------------------------------------
# 5. Service Principal for GitHub Actions
# ---------------------------------------------------------------------------
info "Creating service principal '$SP_NAME' for GitHub Actions..."
AZURE_CREDENTIALS=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --sdk-auth \
  --output json)
success "Service principal created."

# ---------------------------------------------------------------------------
# 6. Print GitHub secrets
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Add the following secrets to your GitHub repository:"
echo "  Settings → Secrets and variables → Actions → New secret"
echo "============================================================"
echo ""
echo "AZURE_CREDENTIALS:"
echo "$AZURE_CREDENTIALS"
echo ""
echo "AZURE_RESOURCE_GROUP:  $RESOURCE_GROUP"
echo "AZURE_AKS_CLUSTER:     $CLUSTER_NAME"
echo ""
echo "============================================================"
echo "  Also add these secrets (fill in your actual values):"
echo "============================================================"
cat << 'EOF'
DOCKERHUB_USERNAME        <your Docker Hub username>
DOCKERHUB_TOKEN           <your Docker Hub access token>

CODEXA_APP_HOST           codexaai.virtualgyans.tech
CODEXA_API_HOST           codexaai.virtualgyans.tech
CODEXA_PREVIEW_DOMAIN     previews.virtualgyans.tech
CODEXA_API_URL            https://codexaai.virtualgyans.tech

POSTGRES_PASSWORD         <strong-password>
ACCOUNT_DB_PASSWORD       <strong-password>
WORKSPACE_DB_PASSWORD     <strong-password>
INTELLIGENCE_DB_PASSWORD  <strong-password>

MINIO_ROOT_USER           minioadmin
MINIO_ROOT_PASSWORD       <strong-password>

JWT_SECRET                <min-32-char-random-string>
STRIPE_API_KEY            sk_test_xxx   (or sk_live_xxx)
STRIPE_WEBHOOK_SECRET     whsec_xxx
AI_API_KEY                sk-xxx

GIT_USERNAME              <github-username>
GIT_PASSWORD              <github-PAT-with-repo-read>
EOF
echo ""

# ---------------------------------------------------------------------------
# 7. Install NGINX Ingress Controller
# ---------------------------------------------------------------------------
info "Installing NGINX Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
  --wait \
  --timeout 5m
success "NGINX Ingress Controller installed."

# ---------------------------------------------------------------------------
# 8. Install cert-manager
# ---------------------------------------------------------------------------
info "Installing cert-manager v1.14.4..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
info "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=Available deployment/cert-manager \
  -n cert-manager --timeout=180s
kubectl wait --for=condition=Available deployment/cert-manager-webhook \
  -n cert-manager --timeout=180s
success "cert-manager installed."

# ---------------------------------------------------------------------------
# 9. Get Ingress IP
# ---------------------------------------------------------------------------
info "Waiting for LoadBalancer IP (may take 1-2 minutes)..."
for i in $(seq 1 24); do
  INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [[ -n "$INGRESS_IP" ]]; then
    break
  fi
  sleep 5
done

if [[ -n "$INGRESS_IP" ]]; then
  success "Ingress IP: $INGRESS_IP"
  echo ""
  echo "============================================================"
  echo "  Use these hostnames for your GitHub secrets:"
  echo "============================================================"
  echo "  CODEXA_APP_HOST:       codexaai.virtualgyans.tech"
  echo "  CODEXA_API_HOST:       codexaai.virtualgyans.tech"
  echo "  CODEXA_PREVIEW_DOMAIN: previews.virtualgyans.tech"
  echo "  CODEXA_API_URL:        https://codexaai.virtualgyans.tech"
  echo "============================================================"
else
  warn "Could not determine Ingress IP yet. Run after a few minutes:"
  warn "  kubectl get svc -n ingress-nginx ingress-nginx-controller"
fi

echo ""
success "Azure resources provisioned successfully!"
echo ""
echo "Next steps:"
echo "  1. Add all GitHub secrets listed above."
echo "  2. Run the 'Bootstrap AKS Cluster' workflow from GitHub Actions."
echo "  3. Push to main to trigger per-service CI/CD pipelines."
