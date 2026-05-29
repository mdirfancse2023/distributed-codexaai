#!/usr/bin/env bash
# Prepare k8s manifests for GKE (storage class + optional domain substitution).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/.k8s-gke-rendered"
STORAGE_CLASS="${GKE_STORAGE_CLASS:-standard-rwo}"

rm -rf "${OUT}"
mkdir -p "${OUT}/infra" "${OUT}/stateful" "${OUT}/services" "${OUT}/proxy"

# GKE uses standard-rwo (or premium-rwo), not Azure managed-csi
for f in "${ROOT}"/k8s/stateful/*.yaml; do
  sed "s/storageClassName: managed-csi/storageClassName: ${STORAGE_CLASS}/g" "$f" \
    > "${OUT}/stateful/$(basename "$f")"
done

for f in "${ROOT}"/k8s/services/*.yaml; do
  cp "$f" "${OUT}/services/$(basename "$f")"
done
cp "${ROOT}"/k8s/proxy/proxy-deployment.yaml "${OUT}/proxy/proxy-deployment.yaml"

if [[ -n "${CODEXA_APP_HOST:-}" && -n "${CODEXA_API_HOST:-}" && -n "${CODEXA_PREVIEW_DOMAIN:-}" ]]; then
  export CODEXA_APP_URL="https://${CODEXA_APP_HOST}"
  export CODEXA_API_URL="https://${CODEXA_API_HOST}"
  envsubst '${CODEXA_APP_HOST} ${CODEXA_API_HOST} ${CODEXA_PREVIEW_DOMAIN} ${CODEXA_APP_URL} ${CODEXA_API_URL}' \
    < "${ROOT}/k8s/infra/namespaces.yaml" > "${OUT}/infra/namespaces.yaml"
  envsubst '${CODEXA_APP_HOST} ${CODEXA_API_HOST} ${CODEXA_PREVIEW_DOMAIN}' \
    < "${ROOT}/k8s/infra/ingress.yaml" > "${OUT}/infra/ingress.yaml"
  envsubst '${CODEXA_APP_HOST} ${CODEXA_API_HOST}' \
    < "${ROOT}/k8s/infra/certificate.yaml" > "${OUT}/infra/certificate.yaml"
else
  cp "${ROOT}"/k8s/infra/namespaces.yaml "${OUT}/infra/namespaces.yaml"
  cp "${ROOT}"/k8s/infra/ingress.yaml "${OUT}/infra/ingress.yaml"
  cp "${ROOT}"/k8s/infra/certificate.yaml "${OUT}/infra/certificate.yaml"
fi

echo "GKE manifests ready in ${OUT} (storageClass=${STORAGE_CLASS})"
