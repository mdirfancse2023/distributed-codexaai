# Kubernetes manifests (shared)

The `k8s/` tree is **cloud-agnostic**. The same manifests deploy to **Azure AKS** or **Google GKE**.

| Path | Contents |
|------|----------|
| `infra/` | Namespaces, ingress, TLS issuer, network policies |
| `services/` | Microservice Deployments + Services |
| `stateful/` | PostgreSQL (pgvector), MinIO, Redis, Kafka |
| `proxy/` | Live preview routing |

## Cloud-specific notes

| Concern | Azure AKS | Google GKE |
|---------|-----------|------------|
| Storage class | `managed-csi` (default in base manifests) | `standard-rwo` via `scripts/prepare-gke-manifests.sh` |
| Ingress | NGINX + Azure LB annotation (bootstrap workflow) | NGINX GCE/cloud deploy manifest |
| CI/CD workflows | `.github/workflows/*.yaml` | `.github/workflows/gke/*.yaml` |
| Bootstrap | `Bootstrap AKS Cluster` | `Bootstrap GKE Cluster` |
| Enable deploys | Always (AKS secrets required) | Set repo variable `ENABLE_GKE_DEPLOY=true` |

## Domain configuration

Copy `infra/domains.env.example` → `infra/domains.env` and run:

```bash
source k8s/infra/domains.env
./scripts/configure-domains.sh      # AKS
./scripts/prepare-gke-manifests.sh  # GKE
```

## Docs

- [DEPLOYMENT.md](../DEPLOYMENT.md) — Azure AKS guide
- [DEPLOYMENT-GKE.md](../DEPLOYMENT-GKE.md) — Google GKE guide
