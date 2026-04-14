#!/usr/bin/env bash
# Build + push images and roll Cloud Run + the worker VM. Idempotent — safe to
# run from a laptop or from CI (auth is whatever gcloud has).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-hakuna-prod-2026}"
REGION="${REGION:-europe-west1}"
ZONE="${ZONE:-europe-west1-b}"
REPO="${REPO:-hakuna-fundraiser}"

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
TAG="${GITHUB_SHA:-$(git rev-parse --short HEAD)}"

API_IMAGE="${REGISTRY}/api:${TAG}"
FRONTEND_IMAGE="${REGISTRY}/frontend:${TAG}"

echo "==> Configuring Docker auth for ${REGION}-docker.pkg.dev"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Discovering API URL for frontend build"
API_URL="$(gcloud run services describe fundraiser-api --region "$REGION" --format='value(status.url)' 2>/dev/null || echo '')"
if [ -z "$API_URL" ]; then
  echo "    fundraiser-api not deployed yet — frontend will use relative /api"
fi

echo "==> Building images"
docker build --platform linux/amd64 -t "$API_IMAGE" -t "${REGISTRY}/api:latest" backend
docker build --platform linux/amd64 \
  --build-arg "VITE_API_URL=${API_URL}" \
  -f frontend/Dockerfile.prod \
  -t "$FRONTEND_IMAGE" -t "${REGISTRY}/frontend:latest" frontend

echo "==> Pushing images"
docker push "$API_IMAGE"
docker push "${REGISTRY}/api:latest"
docker push "$FRONTEND_IMAGE"
docker push "${REGISTRY}/frontend:latest"

echo "==> Deploying Cloud Run: fundraiser-api"
gcloud run deploy fundraiser-api \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --quiet

echo "==> Deploying Cloud Run: fundraiser-frontend"
gcloud run deploy fundraiser-frontend \
  --image "$FRONTEND_IMAGE" \
  --region "$REGION" \
  --quiet

echo "==> Syncing worker VM metadata to new image tag (terraform)"
# The worker VM bakes $IMAGE into its startup-script metadata, so a bare
# `instances reset` would re-pull whatever image TF was last applied with.
# Run a targeted apply so the VM is recreated with the new image baked in.
# (Cloud Run has ignore_changes on its image field, so this won't fight the
# `gcloud run deploy` above.)
terraform -chdir=terraform init -input=false -upgrade=false

TF_EXTRA=()
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "    CLOUDFLARE_API_TOKEN not set — skipping Cloudflare provider"
  TF_EXTRA+=(-var "cloudflare_zone=")
fi

terraform -chdir=terraform apply -auto-approve \
  -var "api_image=${API_IMAGE}" \
  -var "frontend_image=${FRONTEND_IMAGE}" \
  "${TF_EXTRA[@]}" \
  -target=google_compute_instance.worker

echo "==> Rolling worker VM (re-runs startup script, pulls new image)"
# If TF already recreated the VM above this is a no-op safety net; if TF
# decided not to recreate (e.g. same image tag), this forces a fresh pull.
gcloud compute instances reset fundraiser-worker --zone "$ZONE" --quiet || \
  echo "    worker VM not yet created — skip"

echo "==> Done. API: $(gcloud run services describe fundraiser-api --region "$REGION" --format='value(status.url)')"
