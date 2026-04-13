resource "google_cloud_run_v2_service" "api" {
  name     = "fundraiser-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    timeout = "300s"

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    service_account = google_service_account.api.email

    containers {
      name  = "api"
      image = var.api_image

      ports { container_port = 8000 }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      depends_on = ["cloud-sql-proxy"]

      env {
        name  = "ENV"
        value = "production"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CELERY_DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.celery_database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "VERTEX_PROJECT"
        value = var.project_id
      }

      dynamic "env" {
        for_each = {
          ANTHROPIC_API_KEY  = "fundraiser-anthropic-api-key"
          CRUNCHBASE_API_KEY = "fundraiser-crunchbase-api-key"
          PROXYCURL_API_KEY  = "fundraiser-proxycurl-api-key"
          EXA_API_KEY        = "fundraiser-exa-api-key"
          TAVILY_API_KEY     = "fundraiser-tavily-api-key"
          SLACK_WEBHOOK_URL  = "fundraiser-slack-webhook-url"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      liveness_probe {
        http_get {
          path = "/api/health"
          port = 8000
        }
        initial_delay_seconds = 30
        period_seconds        = 30
        failure_threshold     = 3
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 8000
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 24
      }
    }

    # Cloud SQL Auth Proxy sidecar — handles TLS+IAM to Cloud SQL so the API
    # connects to localhost:5432 with no extra config.
    containers {
      name  = "cloud-sql-proxy"
      image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2"

      args = [
        "--structured-logs",
        "--port=5432",
        "--address=0.0.0.0",
        "--private-ip",
        "${var.project_id}:${var.region}:${google_sql_database_instance.primary.name}",
      ]

      resources {
        limits = {
          cpu    = "0.5"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        tcp_socket { port = 5432 }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 12
      }
    }
  }

  depends_on = [
    google_vpc_access_connector.main,
    google_sql_database_instance.primary,
    google_redis_instance.main,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.celery_database_url,
    google_secret_manager_secret_version.redis_url,
    google_secret_manager_secret_version.app,
    google_project_iam_member.api_roles,
  ]

  lifecycle {
    # `gcloud run deploy` from CI rolls the image — don't fight it on apply.
    ignore_changes = [template[0].containers[0].image]
  }
}

# Internal tool — restrict to authenticated Google identities. Grant your team
# `roles/run.invoker` on this service to let them open the URL.
resource "google_cloud_run_v2_service_iam_member" "api_invoker_self" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.frontend.email}"
}
