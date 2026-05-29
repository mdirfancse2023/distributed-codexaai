# Codexa AI — Google GKE Deployment Guide

Use this when deploying to **Google Kubernetes Engine**. The same `k8s/` manifests and Docker Hub images apply; only storage class and CI/CD auth differ from Azure.

## Architecture

```
GitHub Actions (OIDC) → Docker Hub → GKE (codexa-ai namespace)
                                      ├── PostgreSQL, MinIO, Redis, Kafka
                                      └── microservices + frontend + proxy
```

## 1. Create GKE cluster

```bash
gcloud container clusters create lovable-me-cluster \
  --region asia-south1 \
  --num-nodes 2 \
  --machine-type e2-standard-4

gcloud container clusters get-credentials lovable-me-cluster --region asia-south1
```

## 2. GitHub secrets (GKE)

| Secret | Description |
|--------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider |
| `GCP_SERVICE_ACCOUNT` | GCP SA email for GitHub OIDC |
| `GCP_CLUSTER` | GKE cluster name |
| `GCP_ZONE` | Zone or region (e.g. `asia-south1`) |
| `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | Docker Hub |
| `CODEXA_APP_HOST`, `CODEXA_API_HOST`, `CODEXA_PREVIEW_DOMAIN`, `CODEXA_API_URL` | Ingress hosts |
| App secrets | See `.env.example` |

## 3. Enable GKE workflows

GKE deploy workflows are **off by default** so AKS-only repos do not fail.

In GitHub → **Settings** → **Secrets and variables** → **Actions** → **Variables**:

| Variable | Value |
|----------|--------|
| `ENABLE_GKE_DEPLOY` | `true` |

## 4. Bootstrap (one time)

**Actions** → **Bootstrap GKE Cluster** → **Run workflow**

This installs ingress-nginx (GCE), cert-manager, secrets, stateful infra, and all services.

## 5. CI/CD workflows (GKE)

Located under `.github/workflows/gke/`:

| Workflow | Trigger |
|----------|---------|
| `deploy-account-service` | `account-service/**` |
| `deploy-workspace-service` | `workspace-service/**` |
| `deploy-intelligence-service` | `intelligence-service/**` |
| `deploy-api-gateway` | `api-gateway/**` |
| `deploy-config-service` | `config-service/**` |
| `deploy-codexa-frontend` | `codexa-frontend/**` |
| `deploy-preview-routing` | `k8s/proxy/**`, ingress |
| `deploy-infrastructure` | `k8s/stateful/**` |

Shared action: `.github/actions/gke-deploy`

## 6. Storage class

Base manifests use `managed-csi` (Azure). GKE workflows run `scripts/prepare-gke-manifests.sh` to rewrite PVCs to `standard-rwo`.

Override: `GKE_STORAGE_CLASS=premium-rwo ./scripts/prepare-gke-manifests.sh`

## 7. Connect locally

```bash
gcloud container clusters get-credentials <cluster> --region <region>
kubectl get pods -n codexa-ai
```

## 8. Spring Cloud Config

Same as AKS — ensure `application-k8s.yml` in `codexa-config-server` uses in-cluster DNS:

- `pgvector-0.pgvector.codexa-ai.svc.cluster.local:5432`
- `http://minio.codexa-ai.svc.cluster.local:9000`
- `redis-0.redis.codexa-ai.svc.cluster.local:6379`
- `kafka-0.kafka.codexa-ai.svc.cluster.local:9092`

## Dual cloud

You can run **both** AKS and GKE:

- AKS: root `.github/workflows/` (active when Azure secrets are set)
- GKE: `.github/workflows/gke/` (active when `ENABLE_GKE_DEPLOY=true`)

Both pull the same Docker Hub images; each cluster has its own PostgreSQL/MinIO data.
