resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "hakuna-fundraiser"
  format        = "DOCKER"
  description   = "Docker images for the Hakuna fundraiser internal tool"

  cleanup_policies {
    id     = "keep-last-10"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.apis]
}
