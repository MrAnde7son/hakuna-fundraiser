variable "project_id" {
  type        = string
  description = "GCP project ID"
  default     = "hakuna-prod-2026"
}

variable "region" {
  type        = string
  description = "GCP region. me-west1 (Tel Aviv) doesn't support Cloud Run domain mappings; using europe-west1 (Belgium) instead."
  default     = "europe-west1"
}

variable "zone" {
  type        = string
  description = "GCP zone for the worker VM"
  default     = "europe-west1-b"
}

variable "environment" {
  type        = string
  default     = "production"
}

variable "api_image" {
  type        = string
  description = "Full Docker image path for the FastAPI backend (api + worker + beat all share one image). Default = Google's hello placeholder so `terraform apply` works on a clean project; scripts/deploy.sh rolls in the real image."
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  type        = string
  description = "Full Docker image path for the React frontend (nginx). Same placeholder convention as api_image."
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cloud_run_min_instances" {
  type    = number
  default = 0
}

variable "cloud_run_max_instances" {
  type    = number
  default = 3
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "worker_machine_type" {
  type    = string
  default = "e2-small"
}

# ── App secrets ───────────────────────────────────────────────────────────────

variable "anthropic_api_key" {
  type        = string
  description = "Optional. Leave empty to use Vertex AI via the runtime SA's roles/aiplatform.user binding (preferred — same as local)."
  default     = ""
  sensitive   = true
}

variable "crunchbase_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "proxycurl_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "exa_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "tavily_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "slack_webhook_url" {
  type      = string
  default   = ""
  sensitive = true
}

variable "app_domain" {
  type        = string
  description = "Custom domain for the frontend (Cloud Run domain mapping + Cloudflare CNAME)"
  default     = "fundraiser.hakunahq.com"
}

variable "cloudflare_zone" {
  type        = string
  description = "Cloudflare zone that owns app_domain. Empty disables DNS management."
  default     = "hakunahq.com"
}

variable "github_repo" {
  type        = string
  description = "GitHub repo allowed to assume the deployer SA via WIF, e.g. MrAnde7son/hakuna-fundraiser"
  default     = "MrAnde7son/hakuna-fundraiser"
}
