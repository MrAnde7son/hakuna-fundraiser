resource "google_service_account" "api" {
  account_id   = "fundraiser-api"
  display_name = "Fundraiser API (Cloud Run)"
}

resource "google_service_account" "frontend" {
  account_id   = "fundraiser-frontend"
  display_name = "Fundraiser Frontend (Cloud Run)"
}

resource "google_service_account" "worker" {
  account_id   = "fundraiser-worker"
  display_name = "Fundraiser Celery Worker (Compute Engine VM)"
}

locals {
  api_roles = [
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/aiplatform.user",
  ]
  worker_roles = [
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/artifactregistry.reader",
    "roles/aiplatform.user",
  ]
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset(local.api_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_roles" {
  for_each = toset(local.worker_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.worker.email}"
}

# ── GitHub Actions deploy SA + Workload Identity Federation ───────────────────
# Lets the GitHub Actions workflow assume `fundraiser-deployer` without storing
# a JSON key. Same pattern as hakuna-signal.

resource "google_service_account" "deployer" {
  account_id   = "fundraiser-deployer"
  display_name = "Fundraiser GitHub Actions deployer"
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser", # to actAs the runtime SAs on deploy
    "roles/compute.instanceAdmin.v1",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Deployer needs read/write access to the Terraform state bucket so CI can run
# `terraform apply` for the worker VM. The bucket itself is created out of band
# (see README "Bootstrap"), so we bind on it by name rather than referencing a
# `google_storage_bucket` resource.
resource "google_storage_bucket_iam_member" "deployer_tfstate" {
  bucket = "hakuna-terraform-state"
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.deployer.email}"
}

# Pool + provider for GitHub OIDC. The `attribute_condition` restricts it to
# this specific repo so a leaked workflow in another repo can't impersonate.
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "fundraiser-github-pool"
  display_name              = "Fundraiser GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "attribute.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}
