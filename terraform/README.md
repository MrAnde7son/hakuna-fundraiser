# Hakuna Fundraiser — Terraform

Internal-tool deployment on GCP. Mirrors the patterns from `hakuna/terraform`
(Cloud Run + Cloud SQL + Memorystore + Artifact Registry) but trimmed down: no
load balancer, no managed SSL, no read replica.

## Architecture

```
        ┌──────────────────────┐
        │ frontend (Cloud Run) │  ← public, served from *.run.app
        └──────────┬───────────┘
                   │ proxies /api → API_URL
        ┌──────────▼───────────┐
        │  api (Cloud Run)     │  + cloud-sql-proxy sidecar
        └──────────┬───────────┘
        ┌──────────┴───────────┐
        │       VPC            │
        │  ┌──────┐  ┌──────┐  │
        │  │ SQL  │  │Redis │  │
        │  └──────┘  └──────┘  │
        │  ┌──────────────┐    │
        │  │worker VM     │    │  Celery worker + beat (docker-compose)
        │  │(COS)         │    │
        │  └──────────────┘    │
        └──────────────────────┘
```

## Bootstrap

```bash
# 1. Create the state bucket (one-time)
gsutil mb -p hakuna-prod-2026 -l me-west1 gs://hakuna-terraform-state || true
# The deployer SA's access to this bucket is then managed by
# `google_storage_bucket_iam_member.deployer_tfstate` in iam.tf, so make sure
# to run a full `terraform apply` from a trusted workstation before relying on
# CI to run `terraform apply` itself.

# 2. Init + apply the registry first so we can push images
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum, set anthropic_api_key
terraform init
terraform apply -target=google_artifact_registry_repository.main

# 3. Build + push images (or just trigger CI)
../scripts/deploy.sh

# 4. Apply everything
terraform apply
```

## CI/CD setup

After `terraform apply`, configure these as **GitHub Actions Variables** (not
secrets — they're identifiers, not credentials) under repo Settings → Secrets
and variables → Actions → Environment "prod":

- `GCP_WORKLOAD_IDENTITY_PROVIDER` = `terraform output -raw workload_identity_provider`
- `GCP_DEPLOY_SERVICE_ACCOUNT` = `terraform output -raw deployer_service_account`
- `GCP_PROJECT_ID` = `hakuna-prod-2026`
- `GCP_REGION` = `me-west1`

CI authenticates via Workload Identity Federation (no JSON key files).
