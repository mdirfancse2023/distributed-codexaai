#!/usr/bin/env bash
# Substitute domain placeholders in k8s manifests before kubectl apply.
# Usage: source k8s/infra/domains.env && ./scripts/configure-domains.sh

set -euo pipefail

: "${CODEXA_APP_HOST:?Set CODEXA_APP_HOST (e.g. codexa.20.0.0.1.sslip.io)}"
: "${CODEXA_API_HOST:?Set CODEXA_API_HOST (e.g. api.20.0.0.1.sslip.io)}"
: "${CODEXA_PREVIEW_DOMAIN:?Set CODEXA_PREVIEW_DOMAIN (e.g. previews.20.0.0.1.sslip.io)}"

export CODEXA_APP_HOST CODEXA_API_HOST CODEXA_PREVIEW_DOMAIN
export CODEXA_APP_URL="https://${CODEXA_APP_HOST}"
export CODEXA_API_URL="https://${CODEXA_API_HOST}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${ROOT}/.k8s-rendered"
rm -rf "${TMP}"
mkdir -p "${TMP}/infra" "${TMP}/stateful" "${TMP}/services" "${TMP}/proxy"

render() {
  envsubst '${CODEXA_APP_HOST} ${CODEXA_API_HOST} ${CODEXA_PREVIEW_DOMAIN} ${CODEXA_APP_URL} ${CODEXA_API_URL}' \
    < "$1" > "$2"
}

render "${ROOT}/k8s/infra/namespaces.yaml" "${TMP}/infra/namespaces.yaml"
render "${ROOT}/k8s/infra/ingress.yaml" "${TMP}/infra/ingress.yaml"
render "${ROOT}/k8s/infra/certificate.yaml" "${TMP}/infra/certificate.yaml"

for f in "${ROOT}"/k8s/stateful/*.yaml; do
  cp "$f" "${TMP}/stateful/$(basename "$f")"
done
for f in "${ROOT}"/k8s/services/*.yaml; do
  cp "$f" "${TMP}/services/$(basename "$f")"
done
cp "${ROOT}/k8s/proxy/proxy-deployment.yaml" "${TMP}/proxy/proxy-deployment.yaml"

echo "Rendered manifests in ${TMP}"
echo "Apply with: kubectl apply -f ${TMP}/infra/ && kubectl apply -f ${TMP}/stateful/ && ..."
