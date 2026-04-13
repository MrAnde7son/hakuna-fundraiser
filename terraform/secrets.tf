# Database URL — built from the generated password. The Cloud Run API connects
# via the cloud-sql-proxy sidecar on localhost:5432; the worker VM connects via
# Cloud SQL private IP directly.

resource "google_secret_manager_secret" "database_url" {
  secret_id = "fundraiser-database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql+asyncpg://hakuna:${random_password.db_password.result}@localhost:5432/hakuna"
}

# Sync DSN for Celery (uses psycopg, not asyncpg).
resource "google_secret_manager_secret" "celery_database_url" {
  secret_id = "fundraiser-celery-database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "celery_database_url" {
  secret      = google_secret_manager_secret.celery_database_url.id
  secret_data = "postgresql://hakuna:${random_password.db_password.result}@${google_sql_database_instance.primary.private_ip_address}:5432/hakuna"
}

# Direct DSN for the worker VM (private IP, no proxy needed).
resource "google_secret_manager_secret" "worker_database_url" {
  secret_id = "fundraiser-worker-database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "worker_database_url" {
  secret      = google_secret_manager_secret.worker_database_url.id
  secret_data = "postgresql+asyncpg://hakuna:${random_password.db_password.result}@${google_sql_database_instance.primary.private_ip_address}:5432/hakuna"
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "fundraiser-redis-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}/0"
}

# ── External API keys ─────────────────────────────────────────────────────────

locals {
  app_secrets = {
    "fundraiser-anthropic-api-key"  = var.anthropic_api_key
    "fundraiser-crunchbase-api-key" = var.crunchbase_api_key
    "fundraiser-proxycurl-api-key"  = var.proxycurl_api_key
    "fundraiser-exa-api-key"        = var.exa_api_key
    "fundraiser-tavily-api-key"     = var.tavily_api_key
    "fundraiser-slack-webhook-url"  = var.slack_webhook_url
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.app_secrets
  secret_id = each.key
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.app_secrets
  secret   = google_secret_manager_secret.app[each.key].id
  # Empty optional keys still need a version so the env var resolves at runtime.
  secret_data = each.value != "" ? each.value : "disabled"
}
