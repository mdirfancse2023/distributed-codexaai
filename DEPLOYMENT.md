# Codexa AI — Azure AKS Deployment Guide

Production deployment uses **Azure Kubernetes Service (AKS)**, **Docker Hub** images, **GitHub Actions** CI/CD, and in-cluster **PostgreSQL (pgvector)**, **MinIO**, **Redis**, and **Kafka**.

> **Also using Google GKE?** See [DEPLOYMENT-GKE.md](DEPLOYMENT-GKE.md). Both clouds share the same `k8s/` manifests; GKE workflows live under `.github/workflows/gke/`.

---

## Architecture

```
GitHub Actions
  └─ Jib / Docker build → Docker Hub
       └─ kubectl rollout → AKS (codexa-ai namespace)
                             ├── PostgreSQL (pgvector StatefulSet)
                             ├── MinIO (StatefulSet)
                             ├── Redis (StatefulSet)
                             ├── Kafka (StatefulSet)
                             ├── config-service
                             ├── account-service
                             ├── workspace-service
                             ├── intelligence-service
                             ├── api-gateway
                             ├── codexa-frontend
                             └── codexa-ai-proxy (preview routing)
```

---

## Prerequisites

Install these tools locally:

| Tool | Install |
|------|---------|
| Azure CLI | https://learn.microsoft.com/en-us/cli/azure/install-azure-cli |
| kubectl | https://kubernetes.io/docs/tasks/tools/ |
| helm | https://helm.sh/docs/intro/install/ |
| GitHub CLI (`gh`) | https://cli.github.com/ |

---

## Step 1 — Create Azure resources

This script creates the resource group, AKS cluster, service principal, installs NGINX Ingress, and cert-manager.

```bash
az login
chmod +x scripts/create-azure-resources.sh
./scripts/create-azure-resources.sh
```

**Customise defaults** by exporting before running:

```bash
export RESOURCE_GROUP=codexa-rg
export LOCATION=eastus          # az account list-locations -o table
export CLUSTER_NAME=codexa-aks
export NODE_COUNT=2
export NODE_VM_SIZE=Standard_D4s_v3
./scripts/create-azure-resources.sh
```

The script prints:
- `AZURE_CREDENTIALS` JSON for GitHub
- The ingress public IP (use with sslip.io or your own DNS)

---

## Step 2 — GitHub repository secrets

### Option A — Automated (recommended)

```bash
cp .env.example .env
# Edit .env with real values
gh auth login
./scripts/setup-github-secrets.sh
```

### Option B — Manual

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | JSON from `az ad sp create-for-rbac --sdk-auth` (printed by step 1) |
| `AZURE_RESOURCE_GROUP` | e.g. `codexa-rg` |
| `AZURE_AKS_CLUSTER` | e.g. `codexa-aks` |
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (not password) |
| `CODEXA_APP_HOST` | e.g. `codexa.1.2.3.4.sslip.io` |
| `CODEXA_API_HOST` | e.g. `api.1.2.3.4.sslip.io` |
| `CODEXA_PREVIEW_DOMAIN` | e.g. `previews.1.2.3.4.sslip.io` |
| `CODEXA_API_URL` | e.g. `https://api.1.2.3.4.sslip.io` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password |
| `ACCOUNT_DB_PASSWORD` | account_db user password |
| `WORKSPACE_DB_PASSWORD` | workspace_db user password |
| `INTELLIGENCE_DB_PASSWORD` | intelligence_db user password |
| `MINIO_ROOT_USER` | MinIO access key (e.g. `minioadmin`) |
| `MINIO_ROOT_PASSWORD` | MinIO secret key |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `GIT_USERNAME` | GitHub username for config-server repo |
| `GIT_PASSWORD` | GitHub PAT with `repo:read` scope |
| `STRIPE_API_KEY` | Stripe API key (optional) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (optional) |
| `AI_API_KEY` | OpenAI or compatible API key |
| `VITE_UNSPLASH_ACCESS_KEY` | Unsplash key for frontend (optional) |

---

## Step 3 — Spring Cloud Config server

All microservices pull runtime config from the external repo:

`https://github.com/mdirfancse2023/codexa-config-server`

Ensure `application-k8s.yml` in that repo uses in-cluster DNS:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://pgvector-0.pgvector.codexa-ai.svc.cluster.local:5432/<db>

minio:
  endpoint: http://minio.codexa-ai.svc.cluster.local:9000

spring.data.redis:
  host: redis-0.redis.codexa-ai.svc.cluster.local

kafka:
  bootstrap-servers: kafka-0.kafka.codexa-ai.svc.cluster.local:9092
```

---

## Step 4 — Bootstrap the cluster (one time)

1. Push your code to `main` (or just trigger manually).
2. Go to **GitHub → Actions → Bootstrap AKS Cluster → Run workflow**.

What bootstrap does:
- Installs NGINX Ingress Controller + cert-manager
- Creates `codexa-ai` and `codexa-previews` namespaces
- Creates `app-secrets` Kubernetes Secret from GitHub secrets
- Applies RBAC (workspace-service pod management permissions)
- Deploys PostgreSQL, MinIO, Redis, Kafka StatefulSets
- Deploys all microservices and the frontend
- Applies network policies and preview runner pool
- Applies ingress rules and TLS certificate

---

## Step 5 — Configure DNS

After bootstrap, get the ingress IP:

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

**Using sslip.io (no DNS setup needed):**

```
codexa.<IP>.sslip.io      → frontend
api.<IP>.sslip.io         → API gateway
previews.<IP>.sslip.io    → live previews
```

**Using a custom domain:** Create A records pointing to the ingress IP, then update the GitHub secrets `CODEXA_APP_HOST`, `CODEXA_API_HOST`, `CODEXA_PREVIEW_DOMAIN` and re-run **Deploy Preview Routing**.

---

## Step 6 — CI/CD workflows (ongoing)

Every push to `main` triggers the relevant workflow automatically:

| Workflow | Trigger path | What it does |
|----------|-------------|--------------|
| `deploy-account-service` | `account-service/**`, `common-library/**` | Jib → Docker Hub → `kubectl set image` |
| `deploy-workspace-service` | `workspace-service/**`, `common-library/**` | same |
| `deploy-intelligence-service` | `intelligence-service/**`, `common-library/**` | same |
| `deploy-api-gateway` | `api-gateway/**` | same |
| `deploy-config-service` | `config-service/**` | Jib → Docker Hub → deploy |
| `deploy-codexa-frontend` | `codexa-frontend/**` | Docker build → Docker Hub → deploy |
| `deploy-preview-routing` | `k8s/proxy/**`, ingress files | proxy image + ingress + TLS |
| `deploy-infrastructure` | `k8s/stateful/**`, `k8s/infra/rbac.yaml` | PostgreSQL, MinIO, Redis, Kafka, RBAC |
| `bootstrap-aks-cluster` | manual only | full initial setup |

---

## Step 7 — Verify deployment

```bash
# All pods should be Running
kubectl get pods -n codexa-ai

# Check ingress
kubectl get ingress -n codexa-ai

# Health checks
curl https://api.<your-host>/actuator/health
curl https://api.<your-host>/account/actuator/health
curl https://api.<your-host>/workspace/actuator/health
curl https://api.<your-host>/intelligence/actuator/health

# Check logs
kubectl logs -n codexa-ai deployment/account-service --tail=50
kubectl logs -n codexa-ai statefulset/pgvector --tail=50
kubectl logs -n codexa-ai statefulset/minio --tail=50
```

---

## Troubleshooting

### Pods stuck in `Pending`
```bash
kubectl describe pod <pod-name> -n codexa-ai
# Usually a PVC issue — check storage class
kubectl get pvc -n codexa-ai
```

### Config service not starting
```bash
kubectl logs -n codexa-ai deployment/config-service
# Check GIT_USERNAME / GIT_PASSWORD secrets are correct
```

### PostgreSQL init script not running
The init script only runs on a **fresh** (empty) data volume. If the PVC already has data, the script is skipped. To re-run:
```bash
kubectl delete statefulset pgvector -n codexa-ai
kubectl delete pvc pgdata-pgvector-0 -n codexa-ai
kubectl apply -f k8s/stateful/pgvector.yaml
```

### Certificate not issuing
```bash
kubectl describe certificate codexa-cert -n codexa-ai
kubectl describe clusterissuer letsencrypt-prod
# Let's Encrypt requires the domain to be publicly reachable on port 80
```

### Workspace-service can't create preview pods
```bash
kubectl get rolebinding preview-manager-binding -n codexa-previews
kubectl auth can-i create pods \
  --as=system:serviceaccount:codexa-ai:workspace-service-account \
  -n codexa-previews
```

---

## Local development

Start only infrastructure:

```bash
docker compose -f services.docker-compose.yml up -d
```

Run microservices locally with:
```bash
export CONFIG_SERVER_URL=http://localhost:8888
export SPRING_PROFILES_ACTIVE=local
./mvnw spring-boot:run
```

---

## Directory layout

```
k8s/
├── infra/          namespaces, ingress, TLS, network policies, RBAC
├── services/       microservice Deployments + Services
├── stateful/       PostgreSQL, MinIO, Redis, Kafka
└── proxy/          live preview routing proxy
.github/
├── actions/
│   ├── aks-deploy/       Azure login + kubectl context
│   └── gke-deploy/       GCP OIDC + kubectl context
└── workflows/
    ├── *.yaml            AKS per-service CI/CD + bootstrap
    └── gke/*.yaml        GKE (enable with ENABLE_GKE_DEPLOY=true)
scripts/
├── create-azure-resources.sh   Provision AKS cluster + ingress + cert-manager
├── setup-github-secrets.sh     Set all GitHub secrets via gh CLI
├── configure-domains.sh        Render domain placeholders in k8s manifests
└── prepare-gke-manifests.sh    GKE storage class + domain substitution
```

See [DEPLOYMENT-GKE.md](DEPLOYMENT-GKE.md) for Google Cloud setup.
