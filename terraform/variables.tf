variable "project_id" {
  type        = string
  description = "GCP project ID"
  default     = "hakuna-prod-2026"
}

variable "region" {
  type        = string
  description = "GCP region — me-west1 is Tel Aviv"
  default     = "me-west1"
}

variable "zone" {
  type        = string
  description = "GCP zone for the worker VM"
  default     = "me-west1-b"
}

variable "environment" {
  type        = string
  default     = "production"
}

variable "api_image" {
  type        = string
  description = "Full Docker image path for the FastAPI backend (api + worker + beat all share one image)"
  # e.g. me-west1-docker.pkg.dev/hakuna-prod-2026/hakuna-fundraiser/api:latest
}

variable "frontend_image" {
  type        = string
  description = "Full Docker image path for the React frontend (nginx)"
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
  type      = string
  sensitive = true
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

variable "github_repo" {
  type        = string
  description = "GitHub repo allowed to assume the deployer SA via WIF, e.g. MrAnde7son/hakuna-fundraiser"
  default     = "MrAnde7son/hakuna-fundraiser"
}
